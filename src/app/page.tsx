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

// Types for our local chat history
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  widgets?: Widget[];
  isFormSubmitted?: boolean; // Track if user has submitted the widgets for this message
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentWidgetValues, setCurrentWidgetValues] = useState<
    Record<string, any>
  >({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Vercel AI SDK hook for structured object streaming
  const {
    submit,
    isLoading,
    object: partialObject,
  } = useObject({
    api: "/api/query",
    schema: ChatResponseSchema,
    onFinish: ({ object }) => {
      if (object) {
        // When stream finishes, add the complete message to history
        const newMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: object.message,
          widgets: object.widgets || [],
        };
        setMessages((prev) => [...prev, newMessage]);
        setCurrentWidgetValues({}); // Reset form state for new widgets
      }
    },
    onError: (err) => console.error(err),
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, partialObject, isLoading]);

  // Handle standard text submission
  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");

    // Submit complete history to API
    submit({
      messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
    });
  };

  // Handle Widget Form Submission
  const handleWidgetSubmit = (messageId: string, widgets: Widget[]) => {
    // 1. Mark the message's form as submitted so we can disable the UI
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isFormSubmitted: true } : msg,
      ),
    );

    // 2. Format the widget values into a readable string for the LLM
    const formattedResponses = widgets
      .map((w) => {
        const val = currentWidgetValues[w.key];
        return `${w.label}: ${val !== undefined ? val : "(No answer)"}`;
      })
      .join("\n");

    const userContent = `Here are my choices:\n${formattedResponses}`;

    // 3. Add as a user message and submit
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userContent,
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);

    submit({
      messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
    });
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="flex h-14 items-center border-b bg-white px-6 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold">Generative UI Chat</h1>
      </header>

      {/* Chat Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="mx-auto max-w-3xl space-y-6 pb-12">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center pt-24 text-center text-muted-foreground">
              <Bot className="mb-4 h-12 w-12 opacity-20" />
              <p>Describe a task (e.g., "Help me design a character")</p>
            </div>
          )}

          {/* Render History */}
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
                {/* Text Content */}
                <div
                  className={`rounded-lg px-4 py-2 text-sm shadow-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-white dark:bg-zinc-900 border"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Widgets (Only for Assistant) */}
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
                            } // Simplify logic for read-only
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

          {/* Streaming Partial Response */}
          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-600 text-white">
                  <Bot size={16} />
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2 max-w-[80%]">
                {partialObject?.message && (
                  <div className="rounded-lg border bg-white px-4 py-2 text-sm shadow-sm dark:bg-zinc-900">
                    <p className="whitespace-pre-wrap">
                      {partialObject.message}
                    </p>
                  </div>
                )}
                {/* Preview widgets while streaming (optional, usually safer to wait for finish) */}
                {!partialObject?.message && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating
                    interface...
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Footer */}
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
