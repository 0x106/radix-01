// components/app-shell.tsx
import { Sidebar } from "@/components/Sidebar";

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: any;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar user={user} />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-white dark:bg-zinc-950">
        {children}
      </main>
    </div>
  );
}
