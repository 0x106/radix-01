// app/conversation/[id]/page.tsx
"use client";

import { useEffect, useRef, useState, use } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { db } from "@/lib/instant";
import { id as generateId } from "@instantdb/react";
import { ChatResponseSchema, WidgetAction, Widget } from "@/lib/schemas";
import { WidgetRenderer } from "@/components/WidgetRenderer";
import { Input } from "@/components/ui/input"; // Keep for manual input if needed
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent } from "@/components/ui/tabs"; // TabsList & Trigger moved to PageHeader
import { Loader2, LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/page-header"; // New page header
import { ChatInput } from "@/components/chat-input"; // New chat input

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: conversationId } = use(params);

  // --- INSTANTDB QUERY ---
  const { data, isLoading: isDbLoading } = db.useQuery({
    conversations: {
      $: { where: { id: conversationId } },
      messages: { $: { order: { createdAt: "asc" } } },
      containers: {
        $: { order: { label: "asc" } },
        widgets: {},
      },
    },
  });

  const conversation = data?.conversations[0];
  const messages = data?.conversations[0]?.messages || [];
  const containers = data?.conversations[0]?.containers || [];

  const allWidgetsFlat = containers.flatMap((c) => c.widgets);

  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState("messages");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    submit,
    isLoading: isAiLoading,
    object: partialObject,
  } = useObject({
    api: "/api/query",
    schema: ChatResponseSchema,
    onFinish: ({ object }) => {
      if (!object) return;

      const txs = [];
      const timestamp = Date.now();
      const msgId = generateId();

      // Update Title if AI generated one
      if (object.title && object.title !== conversation?.title) {
        txs.push(
          db.tx.conversations[conversationId].update({
            title: object.title,
          }),
        );
      }
      // Update Icon if AI generated one
      if (object.icon && object.icon !== conversation?.icon) {
        txs.push(
          db.tx.conversations[conversationId].update({
            icon: object.icon,
          }),
        );
      }

      txs.push(
        db.tx.messages[msgId]
          .update({
            role: "assistant",
            content: object.message,
            createdAt: timestamp,
          })
          .link({ conversation: conversationId }),
      );

      const containerIdMap = new Map<string, string>();
      const widgetKeyMap = new Map<string, string>();

      if (object.actions) {
        object.actions.forEach((action) => {
          processAction(action, txs, containerIdMap, widgetKeyMap);
        });
      }
      db.transact(txs);
    },
    onError: (err) => console.error("AI Error:", err),
  });

  // Action Processor
  const processAction = (
    action: WidgetAction,
    txs: any[],
    containerIdMap: Map<string, string>,
    widgetKeyMap: Map<string, string>,
  ) => {
    switch (action.type) {
      case "ADD_CONTAINER":
        if (action.container) {
          const realContainerId = generateId();
          containerIdMap.set(action.container.id, realContainerId);
          txs.push(
            db.tx.containers[realContainerId]
              .update({
                label: action.container.label,
                description: action.container.description,
              })
              .link({ conversation: conversationId }),
          );
        }
        break;
      case "UPDATE_CONTAINER":
        if (action.container) {
          // Check if container exists in DB or was just added in this turn
          const targetId =
            containerIdMap.get(action.container.id) || action.container.id;
          // Only update if it's an existing container or a new one being modified in same turn
          if (
            containers.some((c) => c.id === targetId) ||
            containerIdMap.has(action.container.id)
          ) {
            txs.push(db.tx.containers[targetId].merge(action.container));
          }
        }
        break;
      case "DELETE_CONTAINER":
        if (action.targetId) {
          const targetId =
            containerIdMap.get(action.targetId) || action.targetId;
          if (containers.some((c) => c.id === targetId)) {
            txs.push(db.tx.containers[targetId].delete());
          }
        }
        break;
      case "ADD_WIDGET":
        if (action.widget && action.widget.containerId) {
          const resolvedContainerId =
            containerIdMap.get(action.widget.containerId) ||
            action.widget.containerId; // Try to resolve new container IDs

          // Ensure container actually exists or is being created in this transaction
          if (
            !containers.some((c) => c.id === resolvedContainerId) &&
            !containerIdMap.has(action.widget.containerId)
          ) {
            console.warn(
              `Attempted to add widget to non-existent container: ${resolvedContainerId}`,
            );
            return;
          }

          const realWidgetId = generateId();
          widgetKeyMap.set(action.widget.key, realWidgetId);
          const { key, type, label, description, value, ...restProps } =
            action.widget;
          txs.push(
            db.tx.widgets[realWidgetId]
              .update({
                key,
                type,
                label,
                description,
                value: value ?? undefined,
                props: restProps ?? undefined,
              })
              .link({ container: resolvedContainerId }),
          );
        }
        break;
      case "UPDATE_WIDGET":
        if (action.widget) {
          const { key, containerId, ...updates } = action.widget;
          let targetWidgetId = widgetKeyMap.get(key); // Check if created in this turn
          if (!targetWidgetId) {
            const existing = allWidgetsFlat.find((w) => w.key === key);
            if (existing) targetWidgetId = existing.id; // Check existing DB widgets
          }

          if (targetWidgetId) {
            const existingWidget = allWidgetsFlat.find(
              (w) => w.id === targetWidgetId,
            );
            const currentProps = (existingWidget?.props as object) || {};
            const { label, description, type, value, ...restProps } =
              updates as any;

            const updatePayload: any = {};
            if (label !== undefined) updatePayload.label = label;
            if (description !== undefined)
              updatePayload.description = description;
            if (type !== undefined) updatePayload.type = type;
            if (value !== undefined) updatePayload.value = value;

            if (Object.keys(restProps).length > 0) {
              updatePayload.props = { ...currentProps, ...restProps };
            }

            txs.push(db.tx.widgets[targetWidgetId].merge(updatePayload));
          } else {
            console.warn(
              `Attempted to update non-existent widget with key: ${key}`,
            );
          }
        }
        break;
      case "DELETE_WIDGET":
        if (action.targetId) {
          let idToDelete = widgetKeyMap.get(action.targetId);
          if (!idToDelete) {
            const existing = allWidgetsFlat.find(
              (w) => w.key === action.targetId,
            );
            if (existing) idToDelete = existing.id;
          }
          if (idToDelete) txs.push(db.tx.widgets[idToDelete].delete());
        }
        break;
    }
  };

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isAiLoading) return;

    const userContent = input;
    setInput("");
    const msgId = generateId();

    db.transact(
      db.tx.messages[msgId]
        .update({ role: "user", content: userContent, createdAt: Date.now() })
        .link({ conversation: conversationId }),
    );

    const currentState = {
      containers: containers.map((c) => ({ id: c.id, label: c.label })),
      widgets: allWidgetsFlat.map((w) => ({
        key: w.key,
        containerId: w.container?.id,
        type: w.type,
        label: w.label,
        value: w.value,
        ...((w.props as object) || {}),
      })),
    };

    const apiMessages = [
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userContent },
    ];
    apiMessages[apiMessages.length - 1].content +=
      `\n\n[Current State]:\n\`\`\`json\n${JSON.stringify(currentState)}\n\`\`\``;

    submit({ messages: apiMessages });
  };

  const handleWidgetChange = (key: string, val: any) => {
    const widget = allWidgetsFlat.find((w) => w.key === key);
    if (widget) {
      db.transact(db.tx.widgets[widget.id].update({ value: val }));
    }
  };

  useEffect(() => {
    if (activeTab === "messages" && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages.length, isAiLoading, activeTab]);

  if (isDbLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-black">
        <Loader2 className="animate-spin text-slate-300" />
      </div>
    );
  if (!conversation) return <div className="p-10">Conversation not found</div>;

  return (
    <div className="min-h-screen w-full flex flex-col bg-white dark:bg-black relative overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col h-full overflow-hidden"
      >
        {/* --- Header / Tabs --- */}
        <PageHeader
          containers={containers}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          conversationTitle={conversation.title}
          showMessagesTab={true}
        />

        <div className="flex-1 relative overflow-hidden dark:bg-[#0c0c0c]">
          <TabsContent value="messages" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-8 max-w-3xl mx-auto pb-32 min-h-full">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <LayoutDashboard className="h-10 w-10 mb-4 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-500 dark:text-slate-400">
                      Start building your interface.
                    </p>
                  </div>
                )}

                <div className="space-y-6">
                  {messages.map((msg) => {
                    if (msg.role === "user") {
                      return (
                        <div key={msg.id} className="flex justify-end w-full">
                          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm max-w-[90%] shadow-sm">
                            {msg.content}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={msg.id} className="flex flex-col w-full">
                        <span className="text-[10px] font-mono uppercase text-slate-400 mb-1 ml-1">
                          Radix AI
                        </span>
                        <div className="bg-white border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 px-5 py-4 rounded-lg rounded-tl-sm text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap shadow-sm">
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}

                  {isAiLoading && (
                    <div className="flex flex-col w-full opacity-70 animate-pulse">
                      <span className="text-[10px] font-mono uppercase text-indigo-500 mb-1 ml-1">
                        Generating...
                      </span>
                      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 shadow-sm">
                        {partialObject?.message}
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {containers.map((container) => (
            <TabsContent
              key={container.id}
              value={container.id}
              className="h-full m-0"
            >
              <ScrollArea className="h-full">
                <div className="p-8 max-w-3xl mx-auto pb-32">
                  <div className="mb-8 pb-6 border-b border-slate-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-semibold mb-2 text-slate-900 dark:text-white">
                      {container.label}
                    </h2>
                    {container.description && (
                      <p className="text-slate-500 dark:text-slate-400">
                        {container.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-6">
                    {container.widgets.map((widget) => {
                      const widgetProps = (widget.props as object) || {};
                      const fullWidget = {
                        ...widget,
                        ...widgetProps,
                      } as Widget;
                      return (
                        <WidgetRenderer
                          key={widget.id}
                          widget={fullWidget}
                          value={widget.value}
                          onChange={(val) =>
                            handleWidgetChange(widget.key, val)
                          }
                          disabled={isAiLoading}
                        />
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </div>
      </Tabs>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-6 z-30">
        <ChatInput
          input={input}
          setInput={setInput}
          onSubmit={handleTextSubmit}
          isLoading={isAiLoading}
          placeholder={
            activeTab === "messages"
              ? "Describe changes or new interfaces..."
              : `Refine the ${containers.find((c) => c.id === activeTab)?.label || "interface"}...`
          }
          buttonIcon="arrow"
        />
        <div className="text-center mt-2">
          <p className="text-[10px] text-slate-400 font-medium">
            Radix generates and refines UI based on your messages.
          </p>
        </div>
      </div>
    </div>
  );
}
