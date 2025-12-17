// app/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { ChatResponseSchema, Widget } from "@/lib/schemas";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { WidgetRenderer } from "@/components/WidgetRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";

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
  widgets?: Widget[];
  isFormSubmitted?: boolean;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  // Temporary holding state ONLY for the currently streaming widgets.
  // We merge this into the message.widgets array once streaming finishes.
  const [tempStreamValues, setTempStreamValues] = useState<Record<string, any>>(
    {},
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    submit,
    isLoading,
    object: partialObject,
  } = useObject({
    api: "/api/query",
    schema: ChatResponseSchema,
    onFinish: ({ object }) => {
      if (object) {
        // Hydrate the widgets with the values the user typed WHILE it was streaming
        const hydratedWidgets = (object.widgets || []).map((w: any) => ({
          ...w,
          response: tempStreamValues[w.key], // Merge temp values into the widget
        })) as Widget[];

        const newMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: object.message,
          widgets: hydratedWidgets,
        };

        setMessages((prev) => [...prev, newMessage]);
        setTempStreamValues({}); // Clear temp state
      }
    },
    onError: (err) => console.error(err),
  });

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, partialObject, isLoading]);

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    setTempStreamValues({}); // Ensure clean slate

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: input,
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");

    submit({
      messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
    });
  };

  // Update a specific widget's response inside the message history
  const updateMessageWidget = (
    messageId: string,
    widgetKey: string,
    newValue: any,
  ) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || !msg.widgets) return msg;

        return {
          ...msg,
          widgets: msg.widgets.map((w) =>
            w.key === widgetKey ? { ...w, response: newValue } : w,
          ),
        };
      }),
    );
  };

  const handleWidgetSubmit = (messageId: string, widgets: Widget[]) => {
    // 1. Mark form as submitted to lock the UI
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isFormSubmitted: true } : msg,
      ),
    );

    // 2. Serialize the full widgets array (which now includes the 'response' field)
    // We wrap it in a labeled block so the model clearly identifies it as data.
    const payload = JSON.stringify(widgets, null, 2);
    const content = `[Form Submission]\n\`\`\`json\n${payload}\n\`\`\``;

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: content,
    };

    // 3. Update history and submit
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);

    submit({
      messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
    });
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 dark:bg-zinc-950">
      <header className="flex h-14 items-center border-b bg-white px-6 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold">Generative UI Chat</h1>
      </header>

      <ScrollArea className="flex-1 p-4">
        <div className="mx-auto max-w-3xl space-y-6 pb-12">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center pt-24 text-center text-muted-foreground">
              <Bot className="mb-4 h-12 w-12 opacity-20" />
              <p>Describe a task (e.g., "Help me design a character")</p>
            </div>
          )}

          {/* 1. History Messages */}
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

              <div className={`flex flex-col max-w-[80%] gap-2`}>
                {msg.content && (
                  <div
                    className={`rounded-lg px-4 py-2 text-sm shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-white dark:bg-zinc-900 border"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                )}

                {msg.role === "assistant" &&
                  msg.widgets &&
                  msg.widgets.length > 0 && (
                    <Card className="mt-2 w-full min-w-[300px] overflow-hidden border-2 border-blue-100 dark:border-blue-900/30">
                      <div className="bg-blue-50/50 px-4 py-2 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                        Interactive Interface
                      </div>
                      <div className="space-y-6 p-4">
                        {msg.widgets.map((widget) => (
                          <WidgetRenderer
                            key={widget.key}
                            widget={widget}
                            // Pass the response stored IN the widget
                            value={widget.response}
                            disabled={!!msg.isFormSubmitted || isLoading}
                            // Update the specific message's widget list
                            onChange={(val) =>
                              updateMessageWidget(msg.id, widget.key, val)
                            }
                          />
                        ))}
                        {!msg.isFormSubmitted && (
                          <Button
                            className="w-full"
                            onClick={() =>
                              handleWidgetSubmit(msg.id, msg.widgets!)
                            }
                            disabled={isLoading}
                          >
                            Submit Responses
                          </Button>
                        )}
                        {msg.isFormSubmitted && (
                          <div className="text-center text-xs text-muted-foreground italic">
                            Responses submitted
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
              </div>
            </div>
          ))}

          {/* 2. Streaming Response */}
          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-600 text-white">
                  <Bot size={16} />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col max-w-[80%] gap-2">
                {partialObject?.message && (
                  <div className="rounded-lg border bg-white px-4 py-2 text-sm shadow-sm dark:bg-zinc-900">
                    <p className="whitespace-pre-wrap">
                      {partialObject.message}
                    </p>
                  </div>
                )}

                {partialObject?.widgets && partialObject.widgets.length > 0 && (
                  <Card className="mt-2 w-full min-w-[300px] overflow-hidden border-2 border-blue-100 dark:border-blue-900/30">
                    <div className="bg-blue-50/50 px-4 py-2 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Generating Interface...
                    </div>
                    <div className="space-y-6 p-4">
                      {partialObject.widgets.map((widget: any, idx) =>
                        widget?.type && widget?.key ? (
                          <WidgetRenderer
                            key={idx}
                            widget={widget}
                            // Read from temp stream values
                            value={tempStreamValues[widget.key]}
                            // Update temp stream values
                            onChange={(val) =>
                              setTempStreamValues((prev) => ({
                                ...prev,
                                [widget.key]: val,
                              }))
                            }
                          />
                        ) : null,
                      )}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
      {/* ... (footer form remains the same) ... */}
      <div className="p-4 bg-white dark:bg-zinc-900 border-t">
        <form
          onSubmit={handleTextSubmit}
          className="mx-auto flex max-w-3xl items-center gap-2"
        >
          <Input
            placeholder="Send a message..."
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
  );
}
