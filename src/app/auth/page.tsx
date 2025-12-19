// app/auth/page.tsx
"use client";

import { useState } from "react";
import { db } from "@/lib/instant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Loader2, Mail, Lock } from "lucide-react";

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
      console.error("Auth error:", error);
      alert(`Failed to send code: ${error.body?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // FIX: The correct method is signInWithMagicCode
      await db.auth.signInWithMagicCode({ email: sentEmail, code });
      // No manual redirect needed; AuthGuard in layout will detect the user change
    } catch (error: any) {
      console.error("Auth error:", error);
      alert(`Invalid code: ${error.body?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome Back</CardTitle>
          <CardDescription>Sign in to your interface builder</CardDescription>
        </CardHeader>
        <CardContent>
          {!sentEmail ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Send Magic Code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Sent to <strong>{sentEmail}</strong>
                </p>
                <Input
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Verify Code
              </Button>
              <Button
                variant="ghost"
                type="button"
                className="w-full"
                onClick={() => setSentEmail("")}
              >
                Use a different email
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
