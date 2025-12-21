// components/chat-input.tsx
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useRef } from "react";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  isLoading: boolean;
  placeholder?: string;
  buttonIcon?: "arrow" | "chevron";
  hasStarted?: boolean; // For landing page specific styling
}

export function ChatInput({
  input,
  setInput,
  onSubmit,
  isLoading,
  placeholder = "Describe an interface to build...",
  buttonIcon = "arrow",
  hasStarted = true, // Default to started for conversation pages
}: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!hasStarted) {
      inputRef.current?.focus();
    }
  }, [hasStarted]);

  return (
    <div className="relative group">
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 rounded-lg blur opacity-20 transition-opacity",
          hasStarted ? "group-hover:opacity-30" : "opacity-40",
        )}
      />
      <form
        onSubmit={onSubmit}
        className={cn(
          "relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-xl flex items-center gap-2 pl-4 transition-all",
          hasStarted ? "p-1.5" : "p-3",
        )}
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "flex-1 border-0 shadow-none focus-visible:ring-0 bg-transparent font-mono text-sm placeholder:text-slate-400",
            hasStarted ? "h-10" : "h-12 text-base",
          )}
          disabled={isLoading}
          autoFocus={!hasStarted}
        />
        <Button
          size={hasStarted ? "sm" : "default"}
          type="submit"
          disabled={!input.trim() || isLoading}
          className={cn(
            "rounded-lg bg-slate-900 hover:bg-black dark:bg-white dark:text-black dark:hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-0 transition-opacity",
            hasStarted ? "h-9 w-9 p-0" : "h-10 px-6",
          )}
        >
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : buttonIcon === "arrow" ? (
            <ArrowRight className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-6 w-6" />
          )}
        </Button>
      </form>
    </div>
  );
}
