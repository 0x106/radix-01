// app/conversation/[id]/page.tsx
"use client";

import { useEffect, useRef, useState, use, useMemo } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { db } from "@/lib/instant";
import { id as generateId } from "@instantdb/react";
import { ChatResponseSchema, WidgetAction, Widget } from "@/lib/schemas";
import { WidgetRenderer } from "@/components/WidgetRenderer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Loader2, LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ChatInput } from "@/components/chat-input";

// --- Types ---
type ConversationParams = Promise<{ id: string }>;
type MessageRole = "user" | "assistant";

// --- Main Component ---
export default function ConversationPage({
  params,
}: {
  params: ConversationParams;
}) {
  const { id: conversationId } = use(params);

  // 1. Data Fetching
  const {
    conversation,
    messages: dbMessages,
    containers: dbContainers,
    allWidgets,
    isLoading: isDbLoading,
  } = useConversationData(conversationId);

  // 2. UI State
  const [activeTab, setActiveTab] = useState("messages");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 3. AI Handler (Handles streaming & DB commits)
  const {
    submit,
    isLoading: isAiLoading,
    object: partialObject,
  } = useAiHandler(
    conversationId,
    conversation,
    dbMessages,
    allWidgets,
    dbContainers,
  );

  // 4. Optimistic UI (Merges DB state with AI stream)
  const optimisticContainers = useOptimisticState(
    dbContainers,
    partialObject,
    isAiLoading,
  );

  // 5. User Actions
  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isAiLoading) return;

    // Optimistic User Message
    const userContent = input;
    setInput("");

    // DB Commit
    db.transact(
      db.tx.messages[generateId()]
        .update({ role: "user", content: userContent, createdAt: Date.now() })
        .link({ conversation: conversationId }),
    );

    // Prepare Context for AI
    const currentState = serializeCurrentState(dbContainers, allWidgets);
    const apiMessages = [
      ...dbMessages.map((m) => ({
        role: m.role as MessageRole,
        content: m.content,
      })),
      {
        role: "user" as const,
        content: `${userContent}\n\n[Current State]:\n\`\`\`json\n${currentState}\n\`\`\``,
      },
    ];

    submit({ messages: apiMessages });
  };

  const handleWidgetChange = (key: string, val: any) => {
    const widget = allWidgets.find((w) => w.key === key);
    if (widget) {
      db.transact(db.tx.widgets[widget.id].update({ value: val }));
    }
  };

  // Scroll to bottom effect
  useEffect(() => {
    if (activeTab === "messages" && scrollRef.current) {
      setTimeout(
        () => scrollRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    }
  }, [dbMessages.length, isAiLoading, activeTab, partialObject?.message]);

  if (isDbLoading) return <LoadingScreen />;
  if (!conversation) return <div className="p-10">Conversation not found</div>;

  const currentTitle = partialObject?.title ?? conversation.title;

  return (
    <div className="min-h-screen w-full flex flex-col bg-white dark:bg-black relative overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col h-full overflow-hidden"
      >
        <PageHeader
          containers={optimisticContainers}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          conversationTitle={currentTitle}
          showMessagesTab={true}
        />

        <div className="flex-1 relative overflow-hidden dark:bg-[#0c0c0c]">
          {/* Messages Tab */}
          <TabsContent value="messages" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-8 max-w-3xl mx-auto pb-32 min-h-full">
                <MessageList
                  messages={dbMessages}
                  isLoading={isAiLoading}
                  streamingMessage={partialObject?.message}
                />
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Container Tabs */}
          {optimisticContainers.map((container) => (
            <TabsContent
              key={container.id}
              value={container.id}
              className="h-full m-0"
            >
              <ScrollArea className="h-full">
                <div className="p-8 max-w-3xl mx-auto pb-32">
                  <ContainerHeader
                    label={container.label}
                    description={container.description}
                  />
                  <div className="space-y-6">
                    {container.widgets.map((widget: any) => (
                      <WidgetRenderer
                        key={widget.id || widget.key}
                        widget={{ ...widget, ...(widget.props || {}) }}
                        value={widget.value}
                        onChange={(val) =>
                          !widget.id.startsWith("temp-") &&
                          handleWidgetChange(widget.key, val)
                        }
                        disabled={isAiLoading}
                      />
                    ))}
                    {container.widgets.length === 0 && (
                      <div className="text-center py-10 text-slate-400 text-sm">
                        Empty container
                      </div>
                    )}
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
              ? "Describe changes..."
              : "Refine this view..."
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

// --- Sub Components ---

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-white dark:bg-black">
      <Loader2 className="animate-spin text-slate-300" />
    </div>
  );
}

function ContainerHeader({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  return (
    <div className="mb-8 pb-6 border-b border-slate-200 dark:border-zinc-800">
      <h2 className="text-2xl font-semibold mb-2 text-slate-900 dark:text-white">
        {label ?? "Untitled"}
      </h2>
      {description && (
        <p className="text-slate-500 dark:text-slate-400">{description}</p>
      )}
    </div>
  );
}

function MessageList({
  messages,
  isLoading,
  streamingMessage,
}: {
  messages: any[];
  isLoading: boolean;
  streamingMessage?: string;
}) {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 opacity-50">
        <LayoutDashboard className="h-10 w-10 mb-4 text-slate-300 dark:text-slate-600" />
        <p className="text-slate-500 dark:text-slate-400">
          Start building your interface.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex w-full ${msg.role === "user" ? "justify-end" : "flex-col"}`}
        >
          {msg.role === "user" ? (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-slate-100 px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm max-w-[90%] shadow-sm">
              {msg.content}
            </div>
          ) : (
            <>
              <span className="text-[10px] font-mono uppercase text-slate-400 mb-1 ml-1">
                Radix AI
              </span>
              <div className="bg-white border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 px-5 py-4 rounded-lg rounded-tl-sm text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap shadow-sm">
                {msg.content}
              </div>
            </>
          )}
        </div>
      ))}
      {isLoading && streamingMessage && (
        <div className="flex flex-col w-full animate-in fade-in duration-300">
          <span className="text-[10px] font-mono uppercase text-indigo-500 mb-1 ml-1">
            Generating...
          </span>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-5 py-4 rounded-lg rounded-tl-sm text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap shadow-sm">
            {streamingMessage}
            <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-indigo-500 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Custom Hooks ---

function useConversationData(conversationId: string) {
  const { data, isLoading } = db.useQuery({
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
  const containers = conversation?.containers || [];

  return {
    conversation,
    messages: conversation?.messages || [],
    containers,
    allWidgets: containers.flatMap((c) => c.widgets),
    isLoading,
  };
}

function useAiHandler(
  conversationId: string,
  conversation: any,
  dbMessages: any[],
  allWidgets: any[],
  dbContainers: any[],
) {
  return useObject({
    api: "/api/query",
    schema: ChatResponseSchema,
    onFinish: ({ object }) => {
      if (!object) return;
      const txs: any[] = [];

      // 1. Update Metadata
      if (object.title && object.title !== conversation?.title) {
        txs.push(
          db.tx.conversations[conversationId].update({ title: object.title }),
        );
      }
      if (object.icon && object.icon !== conversation?.icon) {
        txs.push(
          db.tx.conversations[conversationId].update({ icon: object.icon }),
        );
      }

      // 2. Add Assistant Message
      txs.push(
        db.tx.messages[generateId()]
          .update({
            role: "assistant",
            content: object.message,
            createdAt: Date.now(),
          })
          .link({ conversation: conversationId }),
      );

      // 3. Process Actions
      if (object.actions) {
        const idMap = new Map<string, string>(); // Virtual ID -> Real ID
        const keyMap = new Map<string, string>(); // Widget Key -> Real ID

        object.actions.forEach((action) => {
          applyActionToTransaction(
            action,
            txs,
            conversationId,
            dbContainers,
            allWidgets,
            idMap,
            keyMap,
          );
        });
      }
      db.transact(txs);
    },
    onError: (err) => console.error("AI Error:", err),
  });
}

/**
 * Merges the database state with the partial AI stream to show instant updates
 */
function useOptimisticState(
  dbContainers: any[],
  partialObject: any,
  isLoading: boolean,
) {
  return useMemo(() => {
    // Deep copy to prevent mutation
    let current = JSON.parse(JSON.stringify(dbContainers)).map((c: any) => ({
      ...c,
      widgets: c.widgets || [],
    }));

    if (!isLoading || !partialObject?.actions) return current;

    for (const action of partialObject.actions) {
      if (!action?.type) continue;
      current = applyOptimisticAction(current, action);
    }
    return current;
  }, [dbContainers, partialObject, isLoading]);
}

// --- Logic Helpers (Pure Functions) ---

function serializeCurrentState(containers: any[], widgets: any[]) {
  return JSON.stringify({
    containers: containers.map((c) => ({ id: c.id, label: c.label })),
    widgets: widgets.map((w) => ({
      key: w.key,
      containerId: w.container?.id,
      type: w.type,
      label: w.label,
      value: w.value,
      ...((w.props as object) || {}),
    })),
  });
}

function applyOptimisticAction(containers: any[], action: WidgetAction) {
  // Helpers
  const findWidget = (key: string) => {
    for (const c of containers) {
      const idx = c.widgets.findIndex((w: any) => w.key === key);
      if (idx !== -1) return { container: c, index: idx };
    }
    return null;
  };

  switch (action.type) {
    case "ADD_CONTAINER":
      if (
        action.container?.id &&
        !containers.find((c) => c.id === action.container!.id)
      ) {
        containers.push({
          id: action.container.id,
          label: action.container.label ?? "New Container...",
          description: action.container.description ?? "",
          widgets: [],
        });
      }
      break;

    case "UPDATE_CONTAINER":
      if (action.container?.id) {
        const target = containers.find((c) => c.id === action.container!.id);
        if (target) Object.assign(target, action.container);
      }
      break;

    case "DELETE_CONTAINER":
      if (action.targetId) {
        return containers.filter((c) => c.id !== action.targetId);
      }
      break;

    case "ADD_WIDGET":
      if (action.widget?.key && action.widget.containerId) {
        const target = containers.find(
          (c) => c.id === action.widget!.containerId,
        );
        if (target) {
          const idx = target.widgets.findIndex(
            (w: any) => w.key === action.widget!.key,
          );
          const newWidget = {
            id: `temp-${action.widget.key}`,
            ...action.widget,
            type: action.widget.type ?? "text",
            label: action.widget.label ?? "New Widget",
          };

          if (idx === -1) target.widgets.push(newWidget);
          else target.widgets[idx] = { ...target.widgets[idx], ...newWidget };
        }
      }
      break;

    case "UPDATE_WIDGET":
      if (action.widget?.key) {
        const found = findWidget(action.widget.key);
        if (found) {
          const existing = found.container.widgets[found.index];
          found.container.widgets[found.index] = {
            ...existing,
            ...action.widget,
            props: {
              ...(existing.props || {}),
              ...(action.widget.props || {}),
            },
          };
        }
      }
      break;

    case "DELETE_WIDGET":
      if (action.targetId) {
        const found = findWidget(action.targetId);
        if (found) found.container.widgets.splice(found.index, 1);
      }
      break;
  }
  return containers;
}

function applyActionToTransaction(
  action: WidgetAction,
  txs: any[],
  conversationId: string,
  dbContainers: any[],
  allWidgets: any[],
  idMap: Map<string, string>,
  keyMap: Map<string, string>,
) {
  // Helper to resolve virtual ID to real ID
  const resolveId = (vid: string) => idMap.get(vid) || vid;
  const resolveWidgetId = (key: string) =>
    keyMap.get(key) || allWidgets.find((w) => w.key === key)?.id;

  switch (action.type) {
    case "ADD_CONTAINER": {
      if (!action.container) return;
      const realId = generateId();
      idMap.set(action.container.id, realId);
      txs.push(
        db.tx.containers[realId]
          .update({
            label: action.container.label,
            description: action.container.description,
          })
          .link({ conversation: conversationId }),
      );
      break;
    }
    case "UPDATE_CONTAINER": {
      if (!action.container) return;
      const realId = resolveId(action.container.id);
      if (
        dbContainers.some((c) => c.id === realId) ||
        idMap.has(action.container.id)
      ) {
        txs.push(db.tx.containers[realId].merge(action.container));
      }
      break;
    }
    case "DELETE_CONTAINER": {
      if (!action.targetId) return;
      const realId = resolveId(action.targetId);
      if (dbContainers.some((c) => c.id === realId)) {
        txs.push(db.tx.containers[realId].delete());
      }
      break;
    }
    case "ADD_WIDGET": {
      if (!action.widget?.containerId) return;
      const containerId = resolveId(action.widget.containerId);
      // Ensure container exists (either in DB or just created in this batch)
      if (
        !dbContainers.some((c) => c.id === containerId) &&
        !idMap.has(action.widget.containerId)
      )
        return;

      const widgetId = generateId();
      keyMap.set(action.widget.key, widgetId);
      const { key, type, label, description, value, ...props } = action.widget;

      txs.push(
        db.tx.widgets[widgetId]
          .update({
            key,
            type,
            label,
            description,
            value: value ?? undefined,
            props: props ?? undefined,
          })
          .link({ container: containerId }),
      );
      break;
    }
    case "UPDATE_WIDGET": {
      if (!action.widget) return;
      const widgetId = resolveWidgetId(action.widget.key);
      if (widgetId) {
        const { key, containerId, label, description, type, value, ...props } =
          action.widget as any;
        const payload: any = {};
        if (label !== undefined) payload.label = label;
        if (description !== undefined) payload.description = description;
        if (type !== undefined) payload.type = type;
        if (value !== undefined) payload.value = value;
        if (Object.keys(props).length > 0) {
          const existing = allWidgets.find((w) => w.id === widgetId);
          payload.props = { ...(existing?.props || {}), ...props };
        }
        txs.push(db.tx.widgets[widgetId].merge(payload));
      }
      break;
    }
    case "DELETE_WIDGET": {
      if (!action.targetId) return;
      const widgetId = resolveWidgetId(action.targetId);
      if (widgetId) txs.push(db.tx.widgets[widgetId].delete());
      break;
    }
  }
}
