// app/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import {
  ChatResponseSchema,
  Widget,
  Container,
  WidgetAction,
} from "@/lib/schemas";
import {
  Send,
  Bot,
  User,
  Loader2,
  Trash2,
  Layout,
  Sparkles,
} from "lucide-react";
import { WidgetRenderer } from "@/components/WidgetRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Utility to generate IDs safely
function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `msg_${new Date().getTime()}_${Math.random().toString(36).slice(2)}`;
}

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  // --- CHAT STATE ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- APP INTERFACE GLOBAL STATE ---
  const [containers, setContainers] = useState<Container[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");

  const {
    submit,
    isLoading,
    object: partialObject,
  } = useObject({
    api: "/api/query",
    schema: ChatResponseSchema,
    onFinish: ({ object }) => {
      if (object && object.actions) {
        // 1. Add the Assistant's explanation to the chat
        const newMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: object.message,
        };
        setMessages((prev) => [...prev, newMessage]);

        // 2. Apply the actions to the global state
        applyActions(object.actions);
      }
    },
    onError: (err) => console.error("AI Error:", err),
  });

  // --- STATE REDUCER ---
  const applyActions = (actions: WidgetAction[]) => {
    let newContainers = [...containers];
    let newWidgets = [...widgets];

    actions.forEach((action) => {
      switch (action.type) {
        // --- CONTAINER ACTIONS ---
        case "ADD_CONTAINER":
          if (
            action.container &&
            !newContainers.find((c) => c.id === action.container!.id)
          ) {
            newContainers.push(action.container);
            // Auto-select the first tab created
            if (newContainers.length === 1) setActiveTab(action.container.id);
          }
          break;

        case "UPDATE_CONTAINER":
          if (action.container) {
            newContainers = newContainers.map((c) =>
              c.id === action.container!.id ? { ...c, ...action.container } : c,
            );
          }
          break;

        case "DELETE_CONTAINER":
          if (action.targetId) {
            newContainers = newContainers.filter(
              (c) => c.id !== action.targetId,
            );
            // Cascade delete: remove widgets belonging to this container
            newWidgets = newWidgets.filter(
              (w) => w.containerId !== action.targetId,
            );

            // If the active tab was deleted, switch to the first available one
            if (activeTab === action.targetId) {
              setActiveTab(newContainers[0]?.id || "");
            }
          }
          break;

        // --- WIDGET ACTIONS ---
        case "ADD_WIDGET":
          if (action.widget) {
            // Prevent duplicate keys
            if (!newWidgets.find((w) => w.key === action.widget!.key)) {
              // The widget might come with a pre-filled 'value' from the AI
              newWidgets.push(action.widget);
            }
          }
          break;

        case "UPDATE_WIDGET":
          if (action.widget) {
            newWidgets = newWidgets.map((w) => {
              if (w.key === action.widget!.key) {
                // COLLABORATIVE VALUE LOGIC:
                // If the AI sends a specific 'value' (e.g. "Draft text..."), we use it.
                // If the AI sends undefined/null for 'value', we KEEP the user's current input.
                const incomingValue = action.widget!.value;
                const newValue =
                  incomingValue !== undefined && incomingValue !== null
                    ? incomingValue
                    : w.value;

                return {
                  ...w, // Keep existing props
                  ...action.widget, // Overwrite with new props
                  value: newValue, // Apply the value logic
                };
              }
              return w;
            });
          }
          break;

        case "DELETE_WIDGET":
          if (action.targetId) {
            newWidgets = newWidgets.filter((w) => w.key !== action.targetId);
          }
          break;
      }
    });

    setContainers(newContainers);
    setWidgets(newWidgets);

    // Fallback: If active tab is empty but we have containers, select the first one
    if (
      newContainers.length > 0 &&
      !newContainers.find((c) => c.id === activeTab)
    ) {
      setActiveTab(newContainers[0].id);
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // --- HANDLERS ---

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    // 1. Add User Message locally
    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: input,
    };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");

    // 2. Prepare Context for AI
    // We send the current state so the AI knows what to ADD, UPDATE, or DELETE.
    // 'widgets' now includes the .value (user input), so the AI can read it.
    const currentState = {
      containers: containers.map((c) => ({ id: c.id, label: c.label })),
      widgets: widgets.map((w) => ({
        key: w.key,
        containerId: w.containerId,
        type: w.type,
        label: w.label,
        value: w.value, // User's current data is sent to AI here
        options: (w as any).options, // Send options so AI knows context for Select/Radio
      })),
    };

    // 3. Construct API Payload
    const apiMessages = newHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Append hidden context to the last message
    const lastMsgIndex = apiMessages.length - 1;
    apiMessages[lastMsgIndex].content +=
      `\n\n[Current State]:\n\`\`\`json\n${JSON.stringify(currentState)}\n\`\`\``;

    submit({ messages: apiMessages });
  };

  // User updates a value (Collaborative editing)
  const handleWidgetChange = (key: string, val: any) => {
    setWidgets((prev) =>
      prev.map((w) => (w.key === key ? { ...w, value: val } : w)),
    );
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to reset the interface?")) {
      setContainers([]);
      setWidgets([]);
      setActiveTab("");
      setMessages([]);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 dark:bg-zinc-950 md:flex-row">
      {/* --- LEFT PANEL: CHAT --- */}
      <div className="flex flex-col h-full w-full md:w-1/2 border-r bg-white dark:bg-zinc-900 transition-all">
        <header className="flex h-14 items-center border-b px-6 bg-white dark:bg-zinc-900 z-10">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            Builder Chat
          </h1>
        </header>

        <ScrollArea className="flex-1 p-4">
          <div className="mx-auto max-w-xl space-y-6 pb-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-20 text-center text-muted-foreground opacity-60">
                <Bot className="mb-4 h-12 w-12" />
                <p>
                  Describe an interface (e.g., "Create a job application form")
                </p>
              </div>
            )}

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

                <div className="flex flex-col max-w-[85%] gap-1">
                  <div
                    className={`rounded-lg px-4 py-2 text-sm shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-slate-100 dark:bg-zinc-800 text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 animate-pulse">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-600 text-white">
                    <Bot size={16} />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col justify-center space-y-2">
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
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
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
            <h2 className="text-lg font-semibold">App Preview</h2>
            <Badge variant="secondary" className="rounded-sm">
              {containers.length} Tabs
            </Badge>
            <Badge variant="outline" className="rounded-sm">
              {widgets.length} Widgets
            </Badge>
          </div>
          {containers.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Reset
            </Button>
          )}
        </header>

        <div className="flex-1 p-6 overflow-hidden">
          {containers.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl border-slate-200 dark:border-zinc-800 bg-slate-100/50 dark:bg-zinc-900/50 m-4">
              <div className="bg-white dark:bg-zinc-800 p-4 rounded-full mb-4 shadow-sm">
                <Layout className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">
                No Interface Generated
              </h3>
              <p className="text-sm opacity-60 mt-1">
                Ask the assistant to build a form for you.
              </p>
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
                      {/* Container Header */}
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

                      {/* Widgets List */}
                      <div className="grid gap-6">
                        {widgets.filter((w) => w.containerId === container.id)
                          .length === 0 ? (
                          <div className="text-center py-10 text-muted-foreground italic border rounded-lg bg-white/50 dark:bg-zinc-900/50">
                            This tab is empty.
                          </div>
                        ) : (
                          widgets
                            .filter((w) => w.containerId === container.id)
                            .map((widget) => (
                              <Card
                                key={widget.key}
                                className="shadow-sm border-slate-200 dark:border-zinc-800"
                              >
                                <CardContent className="p-6">
                                  <WidgetRenderer
                                    widget={widget}
                                    value={widget.value} // Passed from Global State
                                    onChange={(val) =>
                                      handleWidgetChange(widget.key, val)
                                    }
                                    disabled={isLoading}
                                  />
                                </CardContent>
                              </Card>
                            ))
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
