// components/AuthGuard.tsx
"use client";

import { usePathname } from "next/navigation";
import { db } from "@/lib/instant";
import AuthPage from "@/app/auth/page";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell"; // Import the new AppShell

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, user, error } = db.useAuth();
  const pathname = usePathname();

  // 1. Allow public access to landing page
  if (pathname === "/") {
    // The landing page handles its own layout and auth integration now.
    // It should effectively act as the "unauthenticated" view for the root path.
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
  return <AppShell user={user}>{children}</AppShell>;
}
