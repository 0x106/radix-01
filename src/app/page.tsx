// app/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { ChatResponseSchema, Widget, WidgetAction } from "@/lib/schemas";
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

// type Message = {
//   id: string;
//   role: "user" | "assistant";
//   content: string;
//   widgets?: Widget[];
//   isFormSubmitted?: boolean;
//   // New property to control UI visibility
//   isHidden?: boolean;
// };

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [globalWidgets, setGlobalWidgets] = useState<Widget[]>([]);
  const [input, setInput] = useState("");

  const { submit, isLoading } = useObject({
    api: "/api/query",
    schema: ChatResponseSchema,
    onFinish: ({ object }) => {
      if (object?.actions) {
        applyActions(object.actions);
      }
      if (object?.message) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: object.message },
        ]);
      }
    },
  });

  const applyActions = (actions: WidgetAction[]) => {
    setGlobalWidgets((prev) => {
      let next = [...prev];
      actions.forEach((change) => {
        switch (change.action) {
          case "ADD":
            // Avoid duplicates
            if (!next.find((w) => w.key === change.widget.key)) {
              next.push(change.widget);
            }
            break;
          case "UPDATE":
            next = next.map((w) =>
              w.key === change.key ? { ...w, ...change.patch } : w,
            );
            break;
          case "DELETE":
            next = next.filter((w) => w.key !== change.key);
            break;
        }
      });
      return next;
    });
  };

  const handleUpdateWidgetValue = (key: string, value: any) => {
    setGlobalWidgets((prev) =>
      prev.map((w) => (w.key === key ? { ...w, response: value } : w)),
    );
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");

    // Send the history + the CURRENT state of widgets to the LLM
    submit({
      messages: newHistory,
      currentWidgets: globalWidgets,
    });
  };

  const handleFormSubmit = () => {
    // Send the current global state values back as a special message
    const payload = JSON.stringify(globalWidgets, null, 2);
    const submissionMsg = {
      role: "user",
      content: `[Form Submission]\n\`\`\`json\n${payload}\n\`\`\``,
    };

    setMessages((prev) => [...prev, submissionMsg]);
    submit({
      messages: [...messages, submissionMsg],
      currentWidgets: globalWidgets,
    });
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-zinc-950">
      {/* Left side: Chat */}
      <div className="flex flex-1 flex-col border-r">
        <header className="h-14 border-b flex items-center px-4 font-bold">
          Chat
        </header>
        <ScrollArea className="flex-1 p-4">
          {/* Map over messages as usual, but skip rendering widgets here */}
          {messages
            .filter((m) => !m.content.includes("[Form Submission]"))
            .map((m, i) => (
              <div
                key={i}
                className={`mb-4 ${m.role === "user" ? "text-right" : "text-left"}`}
              >
                <div className="inline-block p-3 rounded-lg bg-white shadow-sm border">
                  {m.content}
                </div>
              </div>
            ))}
        </ScrollArea>
        <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type..."
          />
          <Button type="submit">Send</Button>
        </form>
      </div>

      {/* Right side: Global Canvas / Dashboard */}
      <div className="w-[400px] flex flex-col bg-white dark:bg-zinc-900">
        <header className="h-14 border-b flex items-center px-4 font-bold justify-between">
          Dashboard
          <Button size="sm" onClick={handleFormSubmit} disabled={isLoading}>
            Sync State
          </Button>
        </header>
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-8">
            {globalWidgets.map((widget) => (
              <WidgetRenderer
                key={widget.key}
                widget={widget}
                value={widget.response}
                onChange={(val) => handleUpdateWidgetValue(widget.key, val)}
                disabled={isLoading}
              />
            ))}
            {globalWidgets.length === 0 && (
              <p className="text-center text-muted-foreground pt-10">
                No active widgets.
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
