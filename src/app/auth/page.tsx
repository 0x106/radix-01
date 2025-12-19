"use client";

import { useState } from "react";
import { db } from "@/lib/instant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight } from "lucide-react";

export default function AuthPage() {
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
      alert(`Failed to send code: ${error.body?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await db.auth.signInWithMagicCode({ email: sentEmail, code });
    } catch (error: any) {
      alert(`Invalid code: ${error.body?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafafa] dark:bg-[#0a0a0a] p-4 text-center">
      <div className="w-full max-w-[340px] space-y-6">
        <div className="space-y-2">
          <div className="mx-auto h-10 w-10 rounded-md bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-6">
            <div className="h-4 w-4 bg-white rounded-sm" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Interface Builder
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sign in to access your workspace.
          </p>
        </div>

        {!sentEmail ? (
          <form onSubmit={handleSendCode} className="space-y-3">
            <Input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              className="h-10 bg-white dark:bg-zinc-900 shadow-sm border-slate-200 dark:border-zinc-800"
            />
            <Button
              type="submit"
              className="w-full h-10 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-200 font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-3">
            <div className="text-xs text-slate-500 mb-2">
              Code sent to{" "}
              <span className="font-medium text-slate-700">{sentEmail}</span>
            </div>
            <Input
              type="text"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isLoading}
              required
              className="h-10 bg-white text-center tracking-widest font-mono shadow-sm"
              autoFocus
            />
            <Button
              type="submit"
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                "Verify Access"
              )}
            </Button>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors mt-2"
              onClick={() => setSentEmail("")}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>

      <div className="fixed bottom-6 text-xs text-slate-300 dark:text-slate-700 font-mono">
        SECURED BY INSTANT
      </div>
    </div>
  );
}
