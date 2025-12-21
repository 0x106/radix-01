"use client";

import { useState, useRef, useEffect } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { db } from "@/lib/instant";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Rocket,
  ChevronRight,
  LayoutDashboard,
  FormInput,
  Trello,
  Settings,
  CheckSquare,
  Columns,
  Command,
  NotebookText,
} from "lucide-react";
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
import Icon from "@/app/icon.svg";

// --- Types for Local State ---
interface LocalContainer extends Container {
  // Any extra UI state
}
interface LocalWidget extends Widget {
  id: string; // We need a fake ID for local react keys
}

const EXAMPLES = [
  {
    label: "Feedback Form (Iterative)",
    prompt:
      "Create a customer feedback form. Start simple, and I’ll refine the questions as we go.",
    icon: FormInput,
  },
  {
    label: "Planning Workspace",
    prompt:
      "Help me plan a product launch. I want a structured workspace I can update as ideas change.",
    icon: LayoutDashboard,
  },
  {
    label: "Prompt Builder",
    prompt:
      "Build a prompt template I can iteratively improve and reuse for different tasks.",
    icon: Command,
  },
  {
    label: "Comparison Table",
    prompt:
      "Create a comparison table so I can evaluate a few options side by side and adjust criteria.",
    icon: Columns,
  },
  {
    label: "Project Breakdown",
    prompt:
      "Break this project into phases and tasks, and let me reorganize it as we discuss.",
    icon: Trello,
  },
  {
    label: "User Research Notes",
    prompt:
      "Create a structured place to capture and refine user research notes from interviews.",
    icon: NotebookText,
  },
  // {
  //   label: "Decision Log",
  //   prompt:
  //     "Create a decision log where I can track options, tradeoffs, and final choices over time.",
  //   icon: CheckSquare,
  // },
];

export default function LandingPage() {
  const router = useRouter();
  const { user } = db.useAuth();

  // --- UI STATE ---
  const [hasStarted, setHasStarted] = useState(false);

  // --- AUTH STATE ---
  const [sentEmail, setSentEmail] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // --- PLAYGROUND STATE ---
  const [input, setInput] = useState("");
  const [containers, setContainers] = useState<LocalContainer[]>([
    {
      id: "messages",
      label: "Messages",
      description: "Project history and context",
    },
  ]);
  const [widgets, setWidgets] = useState<LocalWidget[]>([
    {
      id: "welcome-msg",
      key: "welcome-msg",
      containerId: "messages",
      type: "text_display",
      label: "Welcome",
      value:
        "Welcome to Radix. I can help you build interfaces. Try asking: 'Create a settings form with a dark mode toggle'.",
      variant: "system",
    } as any,
  ]);
  const [activeTab, setActiveTab] = useState("messages");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- AUTH HANDLERS ---
  useEffect(() => {
    if (user) {
      // Logic to redirect if needed
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

      if (object.message) {
        addTextWidget(object.message, "assistant");
      }

      if (object.actions) {
        object.actions.forEach((action) => applyAction(action));
      }
    },
  });

  const addTextWidget = (text: string, variant: "user" | "assistant") => {
    const newWidget: LocalWidget = {
      id: Math.random().toString(36).substring(7),
      key: `msg-${Date.now()}`,
      containerId: "messages",
      type: "text_display",
      label: "Message",
      value: text,
      variant: variant,
    } as any;

    setWidgets((prev) => [...prev, newWidget]);
  };

  const applyAction = (action: WidgetAction) => {
    switch (action.type) {
      case "ADD_CONTAINER":
        if (action.container) {
          setContainers((prev) => {
            if (prev.find((c) => c.id === action.container!.id)) return prev;
            return [...prev, action.container!];
          });
          if (action.container.id !== "messages")
            setActiveTab(action.container.id);
        }
        break;
      case "ADD_WIDGET":
        if (action.widget) {
          const w = action.widget;
          const targetContainer = w.containerId || "messages";
          setWidgets((prev) => {
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

    if (!hasStarted) setHasStarted(true);

    const userText = input;
    setInput("");

    addTextWidget(userText, "user");

    const history = widgets
      .filter((w) => w.type === "text_display")
      .map((w) => ({
        role: (w as any).variant === "user" ? "user" : "assistant",
        content: String(w.value || ""),
      }));

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
    if (activeTab === "messages" && scrollRef.current) {
      // scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [widgets, activeTab, partialObject, hasStarted]);

  // --- RENDER ---
  return (
    <div className="min-h-screen w-full flex items-center justify-center font-sans bg-white dark:bg-black">
      <div className="w-full h-full overflow-hidden flex flex-col md:flex-row relative">
        {/* --- LEFT PANEL (Auth & Brand) --- */}
        <div className="w-full md:w-100 flex flex-col p-8 md:p-10 shrink-0 z-10 justify-end border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-black h-screen md:h-auto">
          <div>
            <div className="space-y-4 mb-12">
              <div className="flex flex-row gap-2 items-center">
                <div className="h-8 w-8 relative flex flex-row">
                  <Image
                    src={Icon}
                    alt="Radix Logo"
                    fill
                    className="object-contain"
                  />
                </div>
                <h1 className="text-3xl font-bold tracking-tighter text-slate-900 dark:text-white uppercase">
                  RADIX
                </h1>
              </div>
              <p className="text-xs font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Generative AI Workspaces
              </p>
            </div>

            <div className="flex-1 flex flex-col justify-center max-w-[320px]">
              {!user ? (
                !sentEmail ? (
                  <form onSubmit={handleSendCode} className="space-y-4">
                    <div className="space-y-2">
                      <Input
                        type="email"
                        placeholder="hello@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 border-slate-300 dark:border-zinc-700 focus-visible:ring-slate-900 rounded-md bg-transparent"
                        required
                        disabled={isAuthLoading}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-200 rounded-md"
                      disabled={isAuthLoading}
                    >
                      {isAuthLoading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <span className="flex flex-row gap-2 justify-start items-center cursor-pointer">
                          <ChevronRight /> Sign In with Email
                        </span>
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
                        <label className="text-sm font-medium dark:text-slate-200">
                          Magic Code
                        </label>
                        <button
                          type="button"
                          onClick={() => setSentEmail("")}
                          className="text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        >
                          Change email
                        </button>
                      </div>
                      <Input
                        placeholder="123456"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="h-12 border-slate-300 dark:border-zinc-700 text-center text-lg tracking-[0.5em] font-mono rounded-md"
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
                      className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
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
                  <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-md border border-slate-100 dark:border-zinc-800">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                      Signed in as
                    </p>
                    <p className="font-medium truncate dark:text-slate-200">
                      {user.email}
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push("/conversation/new")}
                    className="w-full h-12"
                  >
                    Enter Workspace <ChevronRight className="ml-2 w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => db.auth.signOut()}
                    className="w-full text-slate-500 dark:text-slate-400"
                  >
                    Sign Out
                  </Button>
                </div>
              )}
            </div>
            <div className="mt-auto pt-8">
              <p className="text-[10px] font-mono uppercase text-slate-600 dark:text-slate-500 flex flex-row gap-2 align-center text-center1">
                Built in London
                <Rocket size={12} />
              </p>
            </div>
          </div>
        </div>

        {/* --- RIGHT PANEL (Interactive Playground) --- */}
        <div className="flex-1 flex flex-col min-w-0 relative h-screen">
          {/* CONTENT AREA */}
          <div
            className={cn(
              "flex-1 flex flex-col h-full transition-opacity duration-700 ease-in-out",
              hasStarted ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
          >
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col h-full"
            >
              <div className="border-slate-200 dark:border-zinc-800 bg-white dark:bg-black px-4 h-14 flex items-center shrink-0">
                <TabsList className="bg-transparent h-auto p-0 gap-6">
                  {containers.map((c) => (
                    <TabsTrigger
                      key={c.id}
                      value={c.id}
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-black dark:data-[state=active]:text-white border-b-2 border-transparent data-[state=active]:border-black dark:data-[state=active]:border-white px-2 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-all font-medium text-sm rounded-none cursor-pointer"
                    >
                      {c.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="flex-1 relative overflow-hidden bg-[#fafafa] dark:bg-[#0c0c0c]">
                {containers.map((container) => (
                  <TabsContent
                    key={container.id}
                    value={container.id}
                    className="h-full m-0 data-[state=inactive]:hidden"
                  >
                    <ScrollArea className="h-full">
                      <div className="p-8 max-w-3xl mx-auto pb-32">
                        {container.id !== "messages" && (
                          <div className="mb-8 pb-6 border-b border-slate-100 dark:border-zinc-800">
                            <h2 className="text-2xl font-semibold mb-2 dark:text-white">
                              {container.label}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400">
                              {container.description}
                            </p>
                          </div>
                        )}

                        <div
                          className={cn(
                            "space-y-6",
                            container.id === "messages" ? "space-y-4" : "",
                          )}
                        >
                          {widgets
                            .filter((w) => w.containerId === container.id)
                            .map((widget) => (
                              <WidgetRenderer
                                key={widget.id}
                                widget={widget}
                                value={widget.value}
                                onChange={(val) => {
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

                          {container.id === "messages" &&
                            isAiLoading &&
                            partialObject?.message && (
                              <div className="flex flex-col w-full mb-4 opacity-70 animate-pulse">
                                <span className="text-[10px] font-mono uppercase text-indigo-500 mb-1 ml-1">
                                  Generating...
                                </span>
                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                  {partialObject.message}
                                </div>
                              </div>
                            )}
                          {/*<div ref={scrollRef} />*/}
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          </div>

          {/* INPUT & EXAMPLES AREA */}
          <div
            className={cn(
              "absolute transition-all duration-700 ease-in-out w-full px-6",
              hasStarted
                ? "bottom-6 max-w-3xl left-1/2 -translate-x-1/2"
                : "top-1/2 -translate-y-1/2 max-w-4xl left-1/2 -translate-x-1/2",
            )}
          >
            <div className="relative group">
              <div
                className={cn(
                  "absolute inset-0 bg-linear-to-r from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 rounded-lg blur opacity-20 transition-opacity",
                  hasStarted ? "group-hover:opacity-30" : "opacity-40",
                )}
              />
              <form
                onSubmit={handlePlaygroundSubmit}
                className={cn(
                  "relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-xl flex items-center gap-2 pl-4 transition-all",
                  hasStarted ? "p-1.5" : "p-3",
                )}
              >
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    hasStarted
                      ? "Describe an interface to build..."
                      : "Describe an interface you want to build..."
                  }
                  className={cn(
                    "flex-1 border-0 shadow-none focus-visible:ring-0 bg-transparent font-mono text-sm placeholder:text-slate-400",
                    hasStarted ? "h-10" : "h-12 text-base",
                  )}
                  disabled={isAiLoading}
                  autoFocus={!hasStarted}
                />
                <Button
                  size={hasStarted ? "sm" : "default"}
                  type="submit"
                  disabled={!input.trim() || isAiLoading}
                  className={cn(
                    "rounded-lg bg-slate-900 hover:bg-black dark:bg-white dark:text-black dark:hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-0 transition-opacity",
                    hasStarted ? "h-9 w-9 p-0" : "h-10 px-6",
                  )}
                >
                  {isAiLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <ChevronRight className="h-6 w-6" />
                  )}
                </Button>
              </form>
            </div>

            {/* Example Grid (Only shown before starting) */}
            <div
              className={cn(
                "grid grid-cols-2 md:grid-cols-3 gap-3 mt-8 transition-all duration-500 delay-100",
                hasStarted
                  ? "opacity-0 translate-y-4 pointer-events-none absolute w-full"
                  : "opacity-100 translate-y-0",
              )}
            >
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  onClick={() => {
                    setInput(example.prompt);
                    inputRef.current?.focus();
                  }}
                  className="flex flex-col items-start p-4 h-24 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg hover:border-slate-400 dark:hover:border-zinc-600 hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-center gap-2 mb-2 text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-100 transition-colors">
                    <example.icon className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {example.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {example.prompt}
                  </p>
                </button>
              ))}
            </div>

            {hasStarted && (
              <p className="text-center text-[10px] text-slate-400 mt-3 font-medium animate-in fade-in">
                Changes here are temporary. Sign in to save your workspace.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
