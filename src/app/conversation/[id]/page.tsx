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
import {
  Send,
  Bot,
  User,
  Loader2,
  Trash2,
  Layout,
  Sparkles,
} from "lucide-react";

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
        $: { order: { label: "asc" } }, // Simple ordering
        widgets: {},
      },
    },
  });

  const conversation = data?.conversations[0];
  const messages = data?.conversations[0]?.messages || [];
  const containers = data?.conversations[0]?.containers || [];

  // Flatten widgets from containers for easier access if needed, but we can iterate normally
  // However, we want to know active tab state.
  const [activeTab, setActiveTab] = useState<string>("");

  // Set initial active tab
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

      // 1. Add Assistant Message
      const msgId = generateId();
      txs.push(
        db.tx.messages[msgId]
          .update({
            role: "assistant",
            content: object.message,
            createdAt: Date.now(),
          })
          .link({ conversation: conversationId }),
      );

      // 2. Process Actions
      if (object.actions) {
        object.actions.forEach((action) => {
          processAction(action, txs);
        });
      }

      // Execute all changes atomically
      db.transact(txs);

      // Update Conversation Title if it's the first real interaction
      if (conversation?.title === "New Conversation" && messages.length > 0) {
        // Simple heuristic: rename chat to first user message snippet
        // We can't access 'input' here easily if it's cleared, but we can do it separately.
      }
    },
    onError: (err) => console.error("AI Error:", err),
  });

  const processAction = (action: WidgetAction, txs: any[]) => {
    switch (action.type) {
      case "ADD_CONTAINER":
        if (action.container) {
          txs.push(
            db.tx.containers[action.container.id]
              .update(action.container)
              .link({ conversation: conversationId }),
          );
        }
        break;

      case "UPDATE_CONTAINER":
        if (action.container) {
          txs.push(
            db.tx.containers[action.container.id].merge(action.container),
          );
        }
        break;

      case "DELETE_CONTAINER":
        if (action.targetId) {
          txs.push(db.tx.containers[action.targetId].delete());
        }
        break;

      case "ADD_WIDGET":
        if (action.widget && action.widget.containerId) {
          // Extract known props to save cleanly
          const {
            key,
            type,
            label,
            description,
            containerId,
            value,
            ...restProps
          } = action.widget;

          txs.push(
            db.tx.widgets[key] // Using key as ID for simplicity, or generate a UUID if key isn't unique enough globally
              .update({
                key,
                type,
                label,
                description,
                value: value ?? null, // Save initial value if provided
                props: restProps, // Save other props (min, max, options) as JSON
              })
              .link({ container: containerId }),
          );
        }
        break;

      case "UPDATE_WIDGET":
        if (action.widget) {
          const { key, containerId, ...updates } = action.widget;
          // We need to carefully merge "props" and top-level fields
          // For simplicity, we just merge what we have.
          // Special handling: if 'value' is present, update it.

          // Separate generic props from top-level schema fields
          const { value, label, description, type, ...restProps } = updates;

          const updatePayload: any = {};
          if (label) updatePayload.label = label;
          if (description) updatePayload.description = description;
          if (type) updatePayload.type = type;
          if (value !== undefined) updatePayload.value = value;
          if (Object.keys(restProps).length > 0)
            updatePayload.props = restProps;

          txs.push(db.tx.widgets[action.widget.key].merge(updatePayload));
        }
        break;

      case "DELETE_WIDGET":
        if (action.targetId) {
          txs.push(db.tx.widgets[action.targetId].delete());
        }
        break;
    }
  };

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isAiLoading) return;

    const userContent = input;
    setInput("");

    // 1. Optimistic User Message
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

    // Update title if it's new
    if (conversation?.title === "New Conversation") {
      db.transact(
        db.tx.conversations[conversationId].update({
          title: userContent.slice(0, 30),
        }),
      );
    }

    // 2. Prepare Context
    // We reconstruct the state from DB data to send to AI
    const allWidgets = containers.flatMap((c) => c.widgets);

    const currentState = {
      containers: containers.map((c) => ({ id: c.id, label: c.label })),
      widgets: allWidgets.map((w) => ({
        key: w.key,
        containerId: w.container?.id, // Access via link if populated, but simpler if we know structure
        type: w.type,
        label: w.label,
        value: w.value,
        ...((w.props as object) || {}), // Spread stored JSON props
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
    db.transact(db.tx.widgets[key].update({ value: val }));
  };

  const handleClear = () => {
    if (confirm("Delete this conversation?")) {
      db.transact(db.tx.conversations[conversationId].delete());
      // Router will auto-redirect from layout or we can force it
      // window.location.href = "/";
    }
  };

  // Scroll to bottom
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
                          // Sort widgets to maintain order if you added an order index, otherwise they appear by creation time/ID
                          container.widgets.map((widget) => {
                            // Reconstruct full widget object for renderer
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
