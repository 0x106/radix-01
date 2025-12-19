"use client";

import { useEffect, useRef, useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import {
  ChatResponseSchema,
  Widget,
  Container,
  WidgetAction,
} from "@/lib/schemas";
import { Send, Bot, User, Loader2, Trash2, Layout } from "lucide-react";
import { WidgetRenderer } from "@/components/WidgetRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return `msg_${Date.now()}`;
}

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  // --- GLOBAL STATE ---
  const [containers, setContainers] = useState<Container[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);

  // UI State
  const [activeTab, setActiveTab] = useState<string>("");

  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    submit,
    isLoading,
    object: partialObject,
  } = useObject({
    api: "/api/query",
    schema: ChatResponseSchema,
    onFinish: ({ object }) => {
      if (object && object.actions) {
        setMessages((prev) => [
          ...prev,
          { id: generateId(), role: "assistant", content: object.message },
        ]);
        applyActions(object.actions);
      }
    },
    onError: (err) => console.error(err),
  });

  // --- REDUCER ---
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
            // If it's the first container, set it as active
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
            // Cascade delete widgets
            newWidgets = newWidgets.filter(
              (w) => w.containerId !== action.targetId,
            );
            // Reset active tab if needed
            if (activeTab === action.targetId) {
              setActiveTab(newContainers[0]?.id || "");
            }
          }
          break;

        // --- WIDGET ACTIONS ---
        case "ADD_WIDGET":
          if (action.widget) {
            // Ensure unique key
            if (!newWidgets.find((w) => w.key === action.widget!.key)) {
              newWidgets.push({ ...action.widget, response: null });
            }
          }
          break;
        case "UPDATE_WIDGET":
          if (action.widget) {
            newWidgets = newWidgets.map((w) =>
              w.key === action.widget!.key
                ? { ...action.widget!, response: w.response } // preserve value
                : w,
            );
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

    // Auto-select tab if active tab became invalid but we have containers
    if (
      newContainers.length > 0 &&
      !newContainers.find((c) => c.id === activeTab)
    ) {
      setActiveTab(newContainers[0].id);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const newHistory: Message[] = [
      ...messages,
      { id: generateId(), role: "user", content: input },
    ];
    setMessages(newHistory);
    setInput("");

    // --- CONTEXT INJECTION ---
    const currentState = {
      containers: containers,
      widgets: widgets.map((w) => ({
        key: w.key,
        containerId: w.containerId,
        type: w.type,
        label: w.label,
        current_value: w.response,
      })),
    };

    const apiMessages = newHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    apiMessages[apiMessages.length - 1].content +=
      `\n\n[Current State]:\n\`\`\`json\n${JSON.stringify(currentState)}\n\`\`\``;

    submit({ messages: apiMessages });
  };

  const handleWidgetChange = (key: string, val: any) => {
    setWidgets((prev) =>
      prev.map((w) => (w.key === key ? { ...w, response: val } : w)),
    );
  };

  const handleClear = () => {
    setContainers([]);
    setWidgets([]);
    setActiveTab("");
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 dark:bg-zinc-950 md:flex-row">
      {/* LEFT: Chat */}
      <div className="flex flex-col h-full w-full md:w-1/2 border-r bg-white dark:bg-zinc-900">
        <header className="flex h-14 items-center border-b px-6">
          <h1 className="text-lg font-semibold">Builder Chat</h1>
        </header>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6 pb-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground pt-10">
                <p>
                  Ask me to build a form (e.g., "Create a user profile form")
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {msg.role === "assistant" ? (
                      <Bot size={16} />
                    ) : (
                      <User size={16} />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`rounded-lg px-4 py-2 text-sm max-w-[85%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-slate-100 dark:bg-zinc-800"}`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing actions...</span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
        <div className="p-4 border-t">
          <form onSubmit={handleTextSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* RIGHT: Tabbed Interface */}
      <div className="flex flex-col h-full w-full md:w-1/2 bg-slate-50 dark:bg-zinc-950">
        <header className="flex h-14 items-center justify-between border-b bg-white px-6 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">App Preview</h2>
            <Badge variant="secondary">{containers.length} Tabs</Badge>
          </div>
          {containers.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-red-500"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Reset
            </Button>
          )}
        </header>

        <div className="flex-1 p-6 overflow-hidden">
          {containers.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
              <Layout className="mb-4 h-10 w-10 opacity-20" />
              <p>No active interface</p>
            </div>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="h-full flex flex-col"
            >
              <TabsList className="w-full justify-start overflow-x-auto">
                {containers.map((c) => (
                  <TabsTrigger key={c.id} value={c.id}>
                    {c.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 mt-4 overflow-hidden">
                <ScrollArea className="h-full pr-4">
                  {containers.map((container) => (
                    <TabsContent
                      key={container.id}
                      value={container.id}
                      className="mt-0 space-y-4"
                    >
                      {container.description && (
                        <p className="text-sm text-muted-foreground mb-4">
                          {container.description}
                        </p>
                      )}

                      {widgets.filter((w) => w.containerId === container.id)
                        .length === 0 ? (
                        <div className="text-sm text-muted-foreground italic p-4 text-center">
                          Empty container
                        </div>
                      ) : (
                        widgets
                          .filter((w) => w.containerId === container.id)
                          .map((widget) => (
                            <Card key={widget.key}>
                              <CardContent className="p-6">
                                <WidgetRenderer
                                  widget={widget}
                                  value={widget.response}
                                  onChange={(val) =>
                                    handleWidgetChange(widget.key, val)
                                  }
                                  disabled={isLoading}
                                />
                              </CardContent>
                            </Card>
                          ))
                      )}
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
