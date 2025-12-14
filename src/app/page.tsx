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

  // Shared state for the currently active widgets (both streaming and history)
  const [currentWidgetValues, setCurrentWidgetValues] = useState<
    Record<string, any>
  >({});
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
        // Create the final message
        const newMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: object.message,
          widgets: object.widgets || [],
        };
        setMessages((prev) => [...prev, newMessage]);

        // IMPORTANT: Do NOT clear currentWidgetValues here.
        // This preserves any data the user typed while the widgets were streaming.
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

    // Clear previous widget state when starting a new conversation turn
    setCurrentWidgetValues({});

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

  const handleWidgetSubmit = (messageId: string, widgets: Widget[]) => {
    // 1. Mark form as submitted to lock the UI
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isFormSubmitted: true } : msg,
      ),
    );

    // 2. Format responses for the LLM
    const formattedResponses = widgets
      .map((w) => {
        const val = currentWidgetValues[w.key];
        return `${w.label}: ${val !== undefined ? val : "(No answer)"}`;
      })
      .join("\n");

    // 3. Clear widget state so it doesn't pollute the next turn
    setCurrentWidgetValues({});

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: `Here are my choices:\n${formattedResponses}`,
    };

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
                {/* Text Bubble */}
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

                {/* Render Widgets (Assistant Only) */}
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
                            value={
                              msg.isFormSubmitted
                                ? undefined
                                : currentWidgetValues[widget.key]
                            }
                            disabled={!!msg.isFormSubmitted || isLoading}
                            onChange={(val) =>
                              setCurrentWidgetValues((prev) => ({
                                ...prev,
                                [widget.key]: val,
                              }))
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
                {/* Streaming Text */}
                {partialObject?.message && (
                  <div className="rounded-lg border bg-white px-4 py-2 text-sm shadow-sm dark:bg-zinc-900">
                    <p className="whitespace-pre-wrap">
                      {partialObject.message}
                    </p>
                  </div>
                )}

                {/* Streaming Widgets - Appears instantly! */}
                {partialObject?.widgets && partialObject.widgets.length > 0 && (
                  <Card className="mt-2 w-full min-w-[300px] overflow-hidden border-2 border-blue-100 dark:border-blue-900/30">
                    <div className="bg-blue-50/50 px-4 py-2 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Generating Interface...
                    </div>
                    <div className="space-y-6 p-4">
                      {partialObject.widgets.map((widget, idx) =>
                        // Only render if type is present to prevent layout shift from empty objects
                        widget?.type && widget?.key ? (
                          <WidgetRenderer
                            // Use index as key during streaming to avoid remounts while LLM types the key string
                            key={idx}
                            widget={widget}
                            value={currentWidgetValues[widget.key]}
                            onChange={(val) =>
                              setCurrentWidgetValues((prev) => ({
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
