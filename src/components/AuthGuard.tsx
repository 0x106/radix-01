// components/AuthGuard.tsx
"use client";

import { usePathname } from "next/navigation";
import { db } from "@/lib/instant";
import AuthPage from "@/app/auth/page";
import { Sidebar } from "@/components/Sidebar";
import { Loader2 } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, user, error } = db.useAuth();
  const pathname = usePathname();

  // 1. Allow public access to landing page
  if (pathname === "/") {
    // If we have a user on the landing page, we might want to still render the
    // Landing Page but with a "Go to Dashboard" button, or just render it as is.
    // The prompt implies the landing page IS the auth page, so we render children.
    return <>{children}</>;
  }

  // 2. Loading state for protected routes
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  // 3. Error state
  if (error) {
    return <div className="p-10 text-red-500">Error: {error.message}</div>;
  }

  // 4. Unauthenticated state for protected routes -> Show Auth
  if (!user) {
    return <AuthPage />;
  }

  // 5. Authenticated state -> Show App Shell
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar user={user} />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-white dark:bg-zinc-950">
        {children}
      </main>
    </div>
  );
}
