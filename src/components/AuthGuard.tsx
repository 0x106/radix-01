"use client";

import { db } from "@/lib/instant";
import AuthPage from "@/app/auth/page";
import { Sidebar } from "@/components/Sidebar";
import { Loader2 } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, user, error } = db.useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return <div className="p-10 text-red-500">Error: {error.message}</div>;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <>
      <Sidebar user={user} />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {children}
      </main>
    </>
  );
}
