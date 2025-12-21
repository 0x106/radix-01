// components/auth-forms.tsx
"use client";

import { useState } from "react";
import { db } from "@/lib/instant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface AuthFormsProps {
  onAuthSuccess?: () => void;
  variant: "page" | "landing"; // Differentiate between auth page and landing page styles
}

export function AuthForms({ onAuthSuccess, variant }: AuthFormsProps) {
  const router = useRouter();
  const [sentEmail, setSentEmail] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await db.auth.sendMagicCode({ email });
      setSentEmail(email);
    } catch (error: any) {
      alert(`Error: ${error.body?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await db.auth.signInWithMagicCode({ email: sentEmail, code });
      if (onAuthSuccess) {
        onAuthSuccess();
      } else {
        router.refresh(); // Used for the AuthGuard flow
      }
    } catch (error: any) {
      alert(`Invalid code: ${error.body?.message || error.message}`);
      setIsLoading(false);
    }
  };

  const inputClassNames =
    variant === "page"
      ? "h-10 bg-white dark:bg-zinc-900 shadow-sm border-slate-200 dark:border-zinc-800"
      : "h-12 border-slate-300 dark:border-zinc-700 focus-visible:ring-slate-900 rounded-md bg-transparent";

  const buttonClassNames =
    variant === "page"
      ? "w-full h-10 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-200 font-medium"
      : "w-full h-12 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-200 rounded-md";

  return (
    <div className="flex-1 flex flex-col justify-center">
      {!sentEmail ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <Input
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
            className={inputClassNames}
          />
          <Button
            type="submit"
            className={buttonClassNames}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {variant === "page" ? (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    <ChevronRight /> Sign In with Email
                  </>
                )}
              </>
            )}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={handleVerify}
          className={cn(
            "space-y-4",
            variant === "landing" && "animate-in fade-in slide-in-from-right-4",
          )}
        >
          <div className="space-y-2">
            <div
              className={cn(
                "flex justify-between items-baseline",
                variant === "page" ? "text-xs text-slate-500 mb-2" : "",
              )}
            >
              {variant === "page" ? (
                <>
                  Code sent to{" "}
                  <span className="font-medium text-slate-700">
                    {sentEmail}
                  </span>
                </>
              ) : (
                <>
                  <label className="text-sm font-medium dark:text-slate-200">
                    Magic Code
                  </label>
                </>
              )}
              <button
                type="button"
                onClick={() => setSentEmail("")}
                className={cn(
                  "text-xs",
                  variant === "page"
                    ? "text-slate-400 hover:text-slate-600 transition-colors mt-2"
                    : "text-slate-400 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                {variant === "page" ? "Use a different email" : "Change email"}
              </button>
            </div>
            <Input
              type="text"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isLoading}
              required
              className={cn(
                "text-center tracking-widest font-mono shadow-sm",
                variant === "page"
                  ? "h-10 bg-white"
                  : "h-12 border-slate-300 dark:border-zinc-700 text-lg rounded-md",
              )}
              autoFocus
            />
            {variant === "landing" && (
              <p className="text-xs text-slate-500">Sent to {sentEmail}</p>
            )}
          </div>
          <Button
            type="submit"
            className={cn(
              "w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium",
              variant === "page" ? "h-10" : "",
            )}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="animate-spin h-4 w-4" />
            ) : (
              "Verify Access"
            )}
          </Button>
          {variant === "page" && (
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors mt-2"
              onClick={() => setSentEmail("")}
            >
              Use a different email
            </button>
          )}
        </form>
      )}
    </div>
  );
}
