// app/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { db } from "@/lib/instant";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WidgetRenderer } from "@/components/WidgetRenderer";
import {
  ChatResponseSchema,
  WidgetAction,
  Widget,
  Container,
} from "@/lib/schemas";
import { cn } from "@/lib/utils";
import Icon from "@/app/animated-icon.svg";

// --- Types for Local State ---
interface LocalContainer extends Container {
  // Any extra UI state
}
interface LocalWidget extends Widget {
  id: string; // We need a fake ID for local react keys
}

export default function LandingPage() {
  const router = useRouter();
  const { user } = db.useAuth();

  // --- AUTH STATE ---
  const [sentEmail, setSentEmail] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // --- PLAYGROUND STATE ---
  const [input, setInput] = useState("");
  const [containers, setContainers] = useState<LocalContainer[]>([
    {
      id: "stream",
      label: "Stream",
      description: "Project history and context",
    },
  ]);
  const [widgets, setWidgets] = useState<LocalWidget[]>([
    {
      id: "welcome-msg",
      key: "welcome-msg",
      containerId: "stream",
      type: "text_display",
      label: "Welcome",
      value:
        "Welcome to Radix. I can help you build interfaces. Try asking: 'Create a settings form with a dark mode toggle'.",
      variant: "system",
    } as any,
  ]);
  const [activeTab, setActiveTab] = useState("stream");
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- AUTH HANDLERS ---
  useEffect(() => {
    // If user is already logged in, redirect to their last conversation or a new one
    // But for the purpose of the landing page design, we might want to stay here
    // until they explicitly click "Enter Workspace".
    // For now, let's auto-redirect if they visit root while logged in.
    if (user) {
      // Simple check to find a conversation or create one
      const fetchRecent = async () => {
        // Logic to redirect handled inside Sidebar/Home usually,
        // but here we just push to a new conv to be safe or dashboard
        // For this demo, let's just let them be on the landing page
        // but show "Enter" instead of "Sign In".
      };
      fetchRecent();
    }
  }, [user]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      await db.auth.sendMagicCode({ email });
      setSentEmail(email);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      await db.auth.signInWithMagicCode({ email: sentEmail, code });
      // AuthGuard will handle redirect or layout change once user is detected
      router.refresh();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      setIsAuthLoading(false);
    }
  };

  // --- AI HANDLERS ---
  const {
    submit,
    isLoading: isAiLoading,
    object: partialObject,
  } = useObject({
    api: "/api/query",
    schema: ChatResponseSchema,
    onFinish: ({ object }) => {
      if (!object) return;

      // 1. Convert the final message to a static widget
      if (object.message) {
        addTextWidget(object.message, "assistant");
      }

      // 2. Execute actions
      if (object.actions) {
        object.actions.forEach((action) => applyAction(action));
      }
    },
  });

  // Helper to add chat bubbles as widgets
  const addTextWidget = (text: string, variant: "user" | "assistant") => {
    const newWidget: LocalWidget = {
      id: Math.random().toString(36).substring(7),
      key: `msg-${Date.now()}`,
      containerId: "stream",
      type: "text_display",
      label: "Message",
      value: text,
      variant: variant, // Using the prop we added to schema
    } as any;

    setWidgets((prev) => [...prev, newWidget]);
  };

  // Local State Reducer for AI Actions
  const applyAction = (action: WidgetAction) => {
    switch (action.type) {
      case "ADD_CONTAINER":
        if (action.container) {
          setContainers((prev) => {
            if (prev.find((c) => c.id === action.container!.id)) return prev;
            return [...prev, action.container!];
          });
          // Switch to new tab automatically if it's not the stream
          if (action.container.id !== "stream")
            setActiveTab(action.container.id);
        }
        break;
      case "ADD_WIDGET":
        if (action.widget) {
          const w = action.widget;
          // If no container specified, dump in active tab or stream
          const targetContainer = w.containerId || "stream";
          setWidgets((prev) => {
            // remove if key exists to avoid dupes in this simple playground
            const filtered = prev.filter((pw) => pw.key !== w.key);
            return [
              ...filtered,
              {
                ...w,
                id: Math.random().toString(),
                containerId: targetContainer,
              } as LocalWidget,
            ];
          });
        }
        break;
      case "UPDATE_WIDGET":
        // Simplified local update
        if (action.widget) {
          setWidgets((prev) =>
            prev.map((w) =>
              w.key === action.widget!.key
                ? ({ ...w, ...action.widget } as LocalWidget)
                : w,
            ),
          );
        }
        break;
    }
  };

  const handlePlaygroundSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isAiLoading) return;

    const userText = input;
    setInput("");

    // 1. Add User Widget immediately
    addTextWidget(userText, "user");

    // 2. Construct history for AI
    // We only send the text content, not the full widget structure, to save tokens/complexity
    const history = widgets
      .filter((w) => w.type === "text_display")
      .map((w) => ({
        role: (w as any).variant === "user" ? "user" : "assistant",
        content: String(w.value || ""),
      }));

    // 3. Construct Current State Context
    const currentState = {
      containers: containers.map((c) => ({ id: c.id, label: c.label })),
      widgets: widgets
        .filter((w) => w.type !== "text_display")
        .map((w) => ({
          key: w.key,
          label: w.label,
          value: w.value,
          containerId: w.containerId,
        })),
    };

    const apiMessages = [
      ...history,
      {
        role: "user",
        content:
          userText +
          `\n\n[Current State]:\n\`\`\`json\n${JSON.stringify(currentState)}\n\`\`\``,
      },
    ];

    submit({ messages: apiMessages as any });
  };

  // Scroll to bottom of stream
  useEffect(() => {
    if (activeTab === "stream" && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [widgets, activeTab, partialObject]);

  // --- RENDER ---
  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#111] p-4 md:p-8 flex items-center justify-center font-sans">
      {/* Main Card */}
      <div className="w-full max-w-[1400px] h-[85vh] bg-white dark:bg-black border-2 border-slate-900 dark:border-slate-700 rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl relative">
        {/* --- LEFT PANEL (Auth & Brand) --- */}
        <div className="w-full md:w-[400px] border-b-2 md:border-b-0 md:border-r-2 border-slate-900 dark:border-slate-700 flex flex-col p-8 md:p-10 shrink-0 bg-white dark:bg-black z-10">
          <div className="space-y-4 mb-12">
            <div className="h-10 w-10 relative">
              <Image
                src={Icon}
                alt="Radix Logo"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tighter text-slate-900 dark:text-white mb-1">
                RADIX
              </h1>
              <p className="text-xs font-mono uppercase tracking-widest text-slate-500">
                Generative AI Workspace
              </p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-[320px]">
            {!user ? (
              !sentEmail ? (
                <form onSubmit={handleSendCode} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address</label>
                    <Input
                      type="email"
                      placeholder="hello@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 border-slate-300 dark:border-slate-700 focus-visible:ring-slate-900 rounded-lg bg-transparent"
                      required
                      disabled={isAuthLoading}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800 rounded-lg"
                    disabled={isAuthLoading}
                  >
                    {isAuthLoading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      "Sign In with Email"
                    )}
                  </Button>
                </form>
              ) : (
                <form
                  onSubmit={handleVerify}
                  className="space-y-4 animate-in fade-in slide-in-from-right-4"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <label className="text-sm font-medium">Magic Code</label>
                      <button
                        type="button"
                        onClick={() => setSentEmail("")}
                        className="text-xs text-slate-400 hover:text-slate-900"
                      >
                        Change email
                      </button>
                    </div>
                    <Input
                      placeholder="123456"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="h-12 border-slate-300 text-center text-lg tracking-[0.5em] font-mono rounded-lg"
                      autoFocus
                      required
                      disabled={isAuthLoading}
                    />
                    <p className="text-xs text-slate-500">
                      Sent to {sentEmail}
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                    disabled={isAuthLoading}
                  >
                    {isAuthLoading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      "Verify Access"
                    )}
                  </Button>
                </form>
              )
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                    Signed in as
                  </p>
                  <p className="font-medium truncate">{user.email}</p>
                </div>
                <Button
                  onClick={() => router.push("/conversation/new")}
                  className="w-full h-12"
                >
                  Enter Workspace <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => db.auth.signOut()}
                  className="w-full text-slate-500"
                >
                  Sign Out
                </Button>
              </div>
            )}
          </div>

          <div className="mt-auto pt-8">
            <p className="text-[10px] font-mono uppercase text-slate-300 dark:text-slate-700">
              Built in London
            </p>
          </div>
        </div>

        {/* --- RIGHT PANEL (Interactive Playground) --- */}
        <div className="flex-1 bg-slate-50/50 dark:bg-[#0c0c0c] flex flex-col min-w-0 relative">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col h-full"
          >
            <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-black px-4 h-14 flex items-center shrink-0">
              <TabsList className="bg-transparent h-auto p-0 gap-6">
                {containers.map((c) => (
                  <TabsTrigger
                    key={c.id}
                    value={c.id}
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-indigo-600 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-0 py-3 text-slate-500 hover:text-slate-800 transition-all font-medium text-sm"
                  >
                    {c.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="flex-1 relative overflow-hidden">
              {containers.map((container) => (
                <TabsContent
                  key={container.id}
                  value={container.id}
                  className="h-full m-0 data-[state=inactive]:hidden"
                >
                  <ScrollArea className="h-full">
                    <div className="p-8 max-w-3xl mx-auto pb-32">
                      {/* Container Description */}
                      {container.id !== "stream" && (
                        <div className="mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                          <h2 className="text-2xl font-semibold mb-2">
                            {container.label}
                          </h2>
                          <p className="text-slate-500">
                            {container.description}
                          </p>
                        </div>
                      )}

                      {/* Render Widgets for this Container */}
                      <div
                        className={cn(
                          "space-y-6",
                          container.id === "stream" ? "space-y-4" : "",
                        )}
                      >
                        {widgets
                          .filter((w) => w.containerId === container.id)
                          .map((widget) => (
                            <WidgetRenderer
                              key={widget.id} // use local ID
                              widget={widget}
                              value={widget.value}
                              onChange={(val) => {
                                // Local update
                                setWidgets((prev) =>
                                  prev.map((w) =>
                                    w.id === widget.id
                                      ? { ...w, value: val }
                                      : w,
                                  ),
                                );
                              }}
                              disabled={
                                isAiLoading && widget.type !== "text_display"
                              }
                            />
                          ))}

                        {/* Streaming Partial Message */}
                        {container.id === "stream" &&
                          isAiLoading &&
                          partialObject?.message && (
                            <div className="flex flex-col w-full mb-4 opacity-70">
                              <span className="text-[10px] font-mono uppercase text-slate-400 mb-1 ml-1">
                                Thinking...
                              </span>
                              <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm text-sm text-slate-600">
                                {partialObject.message}
                              </div>
                            </div>
                          )}
                        <div ref={scrollRef} />
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </div>
          </Tabs>

          {/* Input Area (Floating) */}
          <div className="absolute bottom-6 left-6 right-6 max-w-3xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl blur opacity-10 group-hover:opacity-20 transition-opacity" />
              <form
                onSubmit={handlePlaygroundSubmit}
                className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-xl shadow-lg flex items-center gap-2 pl-4"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe an interface to build..."
                  className="flex-1 border-0 shadow-none focus-visible:ring-0 bg-transparent h-10 font-mono text-sm"
                  disabled={isAiLoading}
                />
                <Button
                  size="sm"
                  type="submit"
                  disabled={!input.trim() || isAiLoading}
                  className="h-9 w-9 p-0 rounded-lg bg-slate-900 hover:bg-black dark:bg-white dark:text-black"
                >
                  {isAiLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-3 font-medium">
              Changes here are temporary. Sign in to save your workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
