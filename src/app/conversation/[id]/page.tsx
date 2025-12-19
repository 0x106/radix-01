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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Loader2, Trash2, Layout } from "lucide-react";

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

      // 1. Add Assistant Message
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

      // 2. Process Actions
      const containerIdMap = new Map<string, string>();
      const widgetKeyMap = new Map<string, string>();

      if (object.actions) {
        object.actions.forEach((action) => {
          processAction(action, txs, containerIdMap, widgetKeyMap);
        });
      }

      db.transact(txs);

      if (conversation?.title === "New Conversation" && messages.length > 0) {
        // Optional: Update title logic
      }
    },
    onError: (err) => console.error("AI Error:", err),
  });

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
                // Optional fields: if undefined/null, they are effectively unset in DB
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
            const { value, label, description, type, ...restProps } = updates;

            const updatePayload: any = {};
            if (label) updatePayload.label = label;
            if (description) updatePayload.description = description;
            if (type) updatePayload.type = type;

            // Only update value if it's explicitly provided (including null to clear)
            if (value !== undefined) updatePayload.value = value;

            // Only merge props if they exist
            if (Object.keys(restProps).length > 0)
              updatePayload.props = restProps;

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

          if (idToDelete) {
            txs.push(db.tx.widgets[idToDelete].delete());
          }
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
        .update({
          role: "user",
          content: userContent,
          createdAt: Date.now(),
        })
        .link({ conversation: conversationId }),
    );

    if (conversation?.title === "New Conversation") {
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

    const lastMsgIndex = apiMessages.length - 1;
    apiMessages[lastMsgIndex].content +=
      `\n\n[Current State]:\n\`\`\`json\n${JSON.stringify(currentState)}\n\`\`\``;

    submit({ messages: apiMessages });
  };

  const handleWidgetChange = (key: string, val: any) => {
    const widget = allExistingWidgets.find((w) => w.key === key);
    if (widget) {
      db.transact(db.tx.widgets[widget.id].update({ value: val }));
    }
  };

  const handleClear = () => {
    if (confirm("Delete this conversation?")) {
      db.transact(db.tx.conversations[conversationId].delete());
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAiLoading, partialObject]);

  if (isDbLoading)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (!conversation) return <div className="p-10">Conversation not found</div>;

  return (
    <div className="flex h-full w-full flex-col md:flex-row">
      {/* --- LEFT PANEL: CHAT --- */}
      <div className="flex flex-col h-full w-full md:w-1/2 border-r bg-white dark:bg-zinc-900 transition-all">
        <header className="flex h-14 items-center border-b px-6 bg-white dark:bg-zinc-900 z-10">
          <h1 className="font-semibold truncate">{conversation.title}</h1>
        </header>

        <ScrollArea className="flex-1 p-4">
          <div className="mx-auto max-w-xl space-y-6 pb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <Avatar className="h-8 w-8">
                  {msg.role === "assistant" ? (
                    <>
                      <AvatarImage src="/bot-avatar.png" />
                      <AvatarFallback className="bg-blue-600 text-white">
                        <Bot size={16} />
                      </AvatarFallback>
                    </>
                  ) : (
                    <>
                      <AvatarImage src="/user-avatar.png" />
                      <AvatarFallback className="bg-zinc-800 text-white">
                        <User size={16} />
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div
                  className={`rounded-lg px-4 py-2 text-sm shadow-sm max-w-[85%] whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-slate-100 dark:bg-zinc-800"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isAiLoading && (
              <div className="flex gap-3 animate-pulse">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-600 text-white">
                    <Bot size={16} />
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  {partialObject?.message && (
                    <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm dark:bg-zinc-800">
                      {partialObject.message}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Updating interface...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-white dark:bg-zinc-900">
          <form
            onSubmit={handleTextSubmit}
            className="mx-auto flex max-w-xl items-center gap-2"
          >
            <Input
              placeholder="Describe the interface..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isAiLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isAiLoading || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* --- RIGHT PANEL: PREVIEW --- */}
      <div className="flex flex-col h-full w-full md:w-1/2 bg-slate-50 dark:bg-zinc-950 border-l">
        <header className="flex h-14 items-center justify-between border-b bg-white px-6 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Preview</h2>
            <Badge variant="secondary">{containers.length} Tabs</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
        </header>

        <div className="flex-1 p-6 overflow-hidden">
          {containers.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl border-slate-200 dark:border-zinc-800 bg-slate-100/50 dark:bg-zinc-900/50 m-4">
              <div className="bg-white dark:bg-zinc-800 p-4 rounded-full mb-4 shadow-sm">
                <Layout className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">
                No Interface Yet
              </h3>
            </div>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="h-full flex flex-col"
            >
              <TabsList className="w-full justify-start overflow-x-auto bg-transparent border-b h-auto p-0 rounded-none space-x-6">
                {containers.map((c) => (
                  <TabsTrigger
                    key={c.id}
                    value={c.id}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2"
                  >
                    {c.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 mt-6 overflow-hidden relative">
                <ScrollArea className="h-full pr-4 pb-20">
                  {containers.map((container) => (
                    <TabsContent
                      key={container.id}
                      value={container.id}
                      className="mt-0 space-y-6 data-[state=inactive]:hidden"
                    >
                      <div className="space-y-1">
                        <h3 className="text-lg font-medium">
                          {container.label}
                        </h3>
                        {container.description && (
                          <p className="text-sm text-muted-foreground">
                            {container.description}
                          </p>
                        )}
                      </div>
                      <div className="grid gap-6">
                        {container.widgets.length === 0 ? (
                          <div className="text-center py-10 text-muted-foreground italic border rounded-lg bg-white/50">
                            Empty tab
                          </div>
                        ) : (
                          container.widgets.map((widget) => {
                            const widgetProps = (widget.props as object) || {};
                            const fullWidget = {
                              ...widget,
                              ...widgetProps,
                            } as Widget;

                            return (
                              <Card
                                key={widget.id}
                                className="shadow-sm border-slate-200 dark:border-zinc-800"
                              >
                                <CardContent className="p-6">
                                  <WidgetRenderer
                                    widget={fullWidget}
                                    value={widget.value}
                                    onChange={(val) =>
                                      handleWidgetChange(widget.key, val)
                                    }
                                    disabled={isAiLoading}
                                  />
                                </CardContent>
                              </Card>
                            );
                          })
                        )}
                      </div>
                    </TabsContent>
                  ))}
                </ScrollArea>
              </div>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
