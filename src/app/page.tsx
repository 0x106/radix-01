"use client";

import { useEffect, useRef, useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { ChatResponseSchema, Widget, WidgetAction } from "@/lib/schemas";
import { Send, Bot, User, Loader2, Trash2 } from "lucide-react";
import { WidgetRenderer } from "@/components/WidgetRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  isHidden?: boolean;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  // --- GLOBAL WIDGET STATE ---
  const [globalWidgets, setGlobalWidgets] = useState<Widget[]>([]);

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
        // Add the assistant's text explanation to history
        const newMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: object.message,
        };
        setMessages((prev) => [...prev, newMessage]);

        // APPLY THE ACTIONS TO GLOBAL STATE
        applyWidgetActions(object.actions);
      }
    },
    onError: (err) => console.error(err),
  });

  // --- State Reducer Logic ---
  const applyWidgetActions = (actions: WidgetAction[]) => {
    setGlobalWidgets((currentWidgets) => {
      let newWidgets = [...currentWidgets];

      actions.forEach((action) => {
        if (action.type === "ADD" && action.widget) {
          // Prevent duplicate keys
          const exists = newWidgets.find((w) => w.key === action.key);
          if (!exists) {
            // Initialize with null response
            newWidgets.push({ ...action.widget, response: null });
          }
        } else if (action.type === "UPDATE" && action.widget) {
          newWidgets = newWidgets.map((w) => {
            if (w.key === action.key) {
              // Merge existing state (response) with new definition
              return { ...action.widget!, response: w.response };
            }
            return w;
          });
        } else if (action.type === "DELETE") {
          newWidgets = newWidgets.filter((w) => w.key !== action.key);
        }
      });

      return newWidgets;
    });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: input,
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");

    // --- CRITICAL: INJECT CURRENT STATE INTO CONTEXT ---
    // We create a hidden "system" message or append to the user message
    // so the LLM knows what currently exists.

    // Serialize current state (removing bulky UI stuff if needed, but keeping keys/values)
    const stateContext = JSON.stringify(
      globalWidgets.map((w) => ({
        key: w.key,
        type: w.type,
        label: w.label,
        current_value: w.response, // Pass current values so LLM knows context
        options: (w as any).options, // Pass options so LLM knows what to Update/Delete
      })),
    );

    const contextMessage = `
[Current Widget State]:
\`\`\`json
${stateContext}
\`\`\`
    `;

    // We combine the user input with the context for the API call
    // but we only show the user input in the UI.
    const apiMessages = newHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Append the context to the last message content for the API call
    apiMessages[apiMessages.length - 1].content += `\n\n${contextMessage}`;

    submit({ messages: apiMessages });
  };

  // Update a single widget's value (User Interaction)
  const handleWidgetChange = (key: string, val: any) => {
    setGlobalWidgets((prev) =>
      prev.map((w) => (w.key === key ? { ...w, response: val } : w)),
    );
  };

  // Optional: Allow user to manually "Submit" the form to the chat
  // This just sends the JSON representation of the form to the chat
  const handleFormSubmissionToChat = () => {
    if (isLoading) return;

    const validData = globalWidgets.reduce(
      (acc, w) => {
        if (
          w.response !== null &&
          w.response !== undefined &&
          w.response !== ""
        ) {
          acc[w.key] = w.response;
        }
        return acc;
      },
      {} as Record<string, any>,
    );

    const json = JSON.stringify(validData, null, 2);
    const content = `I have updated the form values:\n\`\`\`json\n${json}\n\`\`\``;

    const userMsg: Message = { id: generateId(), role: "user", content };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);

    // Send state context again
    const stateContext = JSON.stringify(globalWidgets);
    const apiMessages = newHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    apiMessages[apiMessages.length - 1].content +=
      `\n\n[Current Widget State]: ${stateContext}`;

    submit({ messages: apiMessages });
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 dark:bg-zinc-950 md:flex-row">
      {/* LEFT PANEL: Chat History */}
      <div className="flex flex-col h-full w-full md:w-1/2 border-r bg-white dark:bg-zinc-900">
        <header className="flex h-14 items-center border-b px-6">
          <h1 className="text-lg font-semibold">Chat Stream</h1>
        </header>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6 pb-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground pt-10">
                <p>Start chatting to build the interface.</p>
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
                  <AvatarImage
                    src={msg.role === "assistant" ? "/bot.png" : "/user.png"}
                  />
                  <AvatarFallback>
                    {msg.role === "assistant" ? (
                      <Bot size={16} />
                    ) : (
                      <User size={16} />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`rounded-lg px-4 py-2 text-sm max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-slate-100 dark:bg-zinc-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Streaming Indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    <Bot size={16} />
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2 max-w-[85%]">
                  {partialObject?.message && (
                    <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm dark:bg-zinc-800">
                      {partialObject.message}
                    </div>
                  )}
                  {/* Indicate that actions are being processed */}
                  {partialObject?.actions &&
                    partialObject.actions.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-blue-600 animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Updating Interface...
                      </div>
                    )}
                </div>
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

      {/* RIGHT PANEL: Global Widgets Interface */}
      <div className="flex flex-col h-full w-full md:w-1/2 bg-slate-50 dark:bg-zinc-950">
        <header className="flex h-14 items-center justify-between border-b bg-white px-6 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Live Interface</h2>
            <Badge variant="secondary">{globalWidgets.length} Widgets</Badge>
          </div>
          {globalWidgets.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600"
              onClick={() => setGlobalWidgets([])}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Clear
            </Button>
          )}
        </header>

        <ScrollArea className="flex-1 p-6">
          {globalWidgets.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg m-4">
              <Bot className="mb-4 h-10 w-10 opacity-20" />
              <p>No active widgets</p>
              <p className="text-sm opacity-60">
                Ask the AI to create a form for you.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 max-w-2xl mx-auto">
              {globalWidgets.map((widget) => (
                <Card key={widget.key} className="overflow-hidden">
                  <CardHeader className="bg-slate-50 py-3 dark:bg-zinc-900/50">
                    <CardTitle className="text-sm font-medium text-slate-500">
                      {widget.key}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <WidgetRenderer
                      widget={widget}
                      value={widget.response}
                      onChange={(val) => handleWidgetChange(widget.key, val)}
                      disabled={isLoading}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>

        {globalWidgets.length > 0 && (
          <div className="p-4 border-t bg-white dark:bg-zinc-900">
            <Button
              className="w-full"
              onClick={handleFormSubmissionToChat}
              disabled={isLoading}
            >
              Send Form Data to Chat
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
