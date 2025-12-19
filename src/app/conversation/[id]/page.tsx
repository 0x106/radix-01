"use client";

import { useEffect, useRef, useState, use } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { db } from "@/lib/instant";
import { id as generateId } from "@instantdb/react";
import { ChatResponseSchema, WidgetAction, Widget } from "@/lib/schemas";
import { WidgetRenderer } from "@/components/WidgetRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUp,
  Loader2,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: conversationId } = use(params);

  // --- STATE FOR LAYOUT ---
  const [isChatOpen, setIsChatOpen] = useState(true);

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
  const allExistingWidgets = containers.flatMap((c) => c.widgets);
  const [activeTab, setActiveTab] = useState<string>("");

  useEffect(() => {
    if (containers.length > 0 && !activeTab) {
      setActiveTab(containers[0].id);
    }
  }, [containers, activeTab]);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- AI STREAMING ---
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

  // Action Processor (Same as before)
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
          const targetId =
            containerIdMap.get(action.container.id) || action.container.id;
          txs.push(db.tx.containers[targetId].merge(action.container));
        }
        break;
      case "DELETE_CONTAINER":
        if (action.targetId) {
          const targetId =
            containerIdMap.get(action.targetId) || action.targetId;
          txs.push(db.tx.containers[targetId].delete());
        }
        break;
      case "ADD_WIDGET":
        if (action.widget && action.widget.containerId) {
          const resolvedContainerId =
            containerIdMap.get(action.widget.containerId) ||
            action.widget.containerId;
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
          let targetWidgetId = widgetKeyMap.get(key);
          if (!targetWidgetId) {
            const existing = allExistingWidgets.find((w) => w.key === key);
            if (existing) targetWidgetId = existing.id;
          }
          if (targetWidgetId) {
            const existingWidget = allExistingWidgets.find(
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
          }
        }
        break;
      case "DELETE_WIDGET":
        if (action.targetId) {
          let idToDelete = widgetKeyMap.get(action.targetId);
          if (!idToDelete) {
            const existing = allExistingWidgets.find(
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

    if (
      conversation?.title === "New Conversation" ||
      conversation?.title === "Untitled Project"
    ) {
      db.transact(
        db.tx.conversations[conversationId].update({
          title: userContent.slice(0, 30),
        }),
      );
    }

    const currentState = {
      containers: containers.map((c) => ({ id: c.id, label: c.label })),
      widgets: allExistingWidgets.map((w) => ({
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
    const widget = allExistingWidgets.find((w) => w.key === key);
    if (widget) {
      db.transact(db.tx.widgets[widget.id].update({ value: val }));
    }
  };

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiLoading, partialObject]);

  if (isDbLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="animate-spin text-slate-300" />
      </div>
    );
  if (!conversation) return <div className="p-10">Conversation not found</div>;

  return (
    <div className="flex h-full w-full bg-white dark:bg-[#09090b] overflow-hidden">
      {/* --- LEFT PANEL: CHAT --- */}
      {/* We conditionally hide it using 'hidden' class to preserve DOM state if needed, or just remove it.
          'hidden' is safer for scroll positions if we un-hide later. */}
      <div
        className={cn(
          "flex flex-col h-full border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0 z-10 transition-all duration-300 ease-in-out",
          isChatOpen
            ? "w-[400px] opacity-100"
            : "w-0 opacity-0 overflow-hidden border-none",
        )}
      >
        <header className="h-12 flex items-center px-5 border-b border-slate-100 dark:border-zinc-900 shrink-0 justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <h1 className="font-semibold text-sm tracking-tight text-slate-900 dark:text-slate-100 truncate">
              {conversation.title}
            </h1>
            <Badge
              variant="outline"
              className="font-normal text-slate-500 rounded-md border-slate-200 text-[10px] h-5 px-1.5"
            >
              v1.0
            </Badge>
          </div>

          {/* Close Chat Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
            onClick={() => setIsChatOpen(false)}
            title="Collapse Chat"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 min-h-0 relative group">
          <ScrollArea className="h-full">
            <div className="px-5 py-6 space-y-8 pb-4">
              {messages.length === 0 && (
                <div className="mt-10 text-center text-sm text-slate-400">
                  <p>Describe the interface you want to build.</p>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col gap-1 max-w-[95%]",
                    msg.role === "user"
                      ? "ml-auto items-end"
                      : "mr-auto items-start",
                  )}
                >
                  <div
                    className={cn(
                      "px-3.5 py-2.5 text-sm leading-relaxed rounded-[12px]",
                      msg.role === "user"
                        ? "bg-[#222] text-white rounded-tr-sm"
                        : "bg-slate-100 dark:bg-zinc-900 text-slate-800 dark:text-slate-300 rounded-tl-sm",
                    )}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-slate-300 font-medium px-1">
                    {msg.role === "user" ? "You" : "Assistant"}
                  </span>
                </div>
              ))}

              {isAiLoading && (
                <div className="flex flex-col gap-1 mr-auto max-w-[90%]">
                  <div className="bg-slate-50 border border-slate-100 dark:bg-zinc-900 px-3.5 py-2.5 rounded-[12px] rounded-tl-sm text-sm text-slate-600">
                    {partialObject?.message || (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />{" "}
                        processing...
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-zinc-900 bg-white/50 backdrop-blur-sm shrink-0">
          <div className="relative">
            <Input
              placeholder="Type instructions..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isAiLoading}
              className="pr-10 h-11 bg-white border-slate-200 focus-visible:ring-indigo-500/20 shadow-sm rounded-[8px]"
              onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
            />
            <Button
              size="sm"
              className={cn(
                "absolute right-1.5 top-1.5 h-8 w-8 rounded-[6px] transition-all",
                input.trim()
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-slate-100 text-slate-400",
              )}
              onClick={() => handleTextSubmit()}
              disabled={isAiLoading || !input.trim()}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* --- RIGHT PANEL: PREVIEW --- */}
      <div className="flex-1 flex flex-col h-full bg-[#f8f9fc] dark:bg-[#0c0c0c] relative min-w-0 transition-all duration-300">
        <div className="flex-1 overflow-hidden flex flex-col h-full">
          {containers.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-slate-400">
              {/* Show Open Chat button if empty and closed */}
              {!isChatOpen && (
                <Button
                  variant="outline"
                  className="absolute top-4 left-4 gap-2 bg-white"
                  onClick={() => setIsChatOpen(true)}
                >
                  <PanelLeftOpen className="h-4 w-4" />
                  Open Chat
                </Button>
              )}
              <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
                <div className="h-8 w-8 rounded-sm border-2 border-dashed border-slate-300 dark:border-zinc-700" />
              </div>
              <span className="font-medium text-sm">
                Waiting for generation...
              </span>
            </div>
          ) : (
            <div className="w-full bg-white flex flex-col h-full overflow-hidden">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex flex-col h-full w-full"
              >
                {/* Tabs Header */}
                <div className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 px-2 pt-2 h-12 shrink-0 flex items-center">
                  {/* Expand Chat Button (Only visible when chat is closed) */}
                  {!isChatOpen && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 mr-2 text-slate-500 hover:text-indigo-600 hover:bg-white shadow-sm"
                      onClick={() => setIsChatOpen(true)}
                      title="Open Chat"
                    >
                      <PanelLeftOpen className="h-4 w-4" />
                    </Button>
                  )}

                  <TabsList className="bg-transparent gap-1 w-full justify-start h-auto p-0">
                    {containers.map((c) => (
                      <TabsTrigger
                        key={c.id}
                        value={c.id}
                        className="px-4 py-2.5 rounded-t-md rounded-b-none border border-transparent data-[state=active]:bg-white data-[state=active]:border-slate-200 data-[state=active]:border-b-white data-[state=active]:shadow-sm text-xs font-medium text-slate-500 data-[state=active]:text-indigo-600 relative top-px"
                      >
                        {c.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <div className="flex-1 min-h-0 bg-white dark:bg-zinc-950 relative">
                  <ScrollArea className="h-full">
                    {containers.map((container) => (
                      <TabsContent
                        key={container.id}
                        value={container.id}
                        className="mt-0 p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300"
                      >
                        <div className="space-y-1 mb-6">
                          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                            {container.label}
                          </h2>
                          {container.description && (
                            <p className="text-sm text-slate-500">
                              {container.description}
                            </p>
                          )}
                        </div>

                        <div className="grid gap-6 max-w-4xl mx-auto">
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
                      </TabsContent>
                    ))}
                  </ScrollArea>
                </div>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
