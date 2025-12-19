"use client";

import { useState } from "react";
import { db } from "@/lib/instant";
import { id } from "@instantdb/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Trash2,
  Command,
  ChevronsLeft,
  ChevronsRight,
  MessageSquare,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar({ user }: { user: any }) {
  const router = useRouter();
  const params = useParams();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { data } = db.useQuery({
    conversations: {
      $: { where: { "owner.id": user.id }, order: { createdAt: "desc" } },
    },
  });

  const handleNewChat = () => {
    const newId = id();
    db.transact(
      db.tx.conversations[newId]
        .update({
          title: "Untitled Project",
          createdAt: Date.now(),
        })
        .link({ owner: user.id }),
    );
    router.push(`/conversation/${newId}`);
  };

  const handleDelete = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (confirm("Delete this thread?")) {
      db.transact(db.tx.conversations[convId].delete());
      if (params.id === convId) router.push("/");
    }
  };

  const handleLogout = () => {
    db.auth.signOut();
  };

  return (
    <div
      className={cn(
        "border-r border-slate-200 dark:border-zinc-800 bg-[#fbfbfb] dark:bg-[#0c0c0c] flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[60px]" : "w-[260px]",
      )}
    >
      {/* Brand / Header */}
      <div
        className={cn(
          "h-12 flex items-center border-b border-slate-100 dark:border-zinc-800/50",
          isCollapsed ? "justify-center px-0" : "px-4 justify-between",
        )}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2 font-semibold text-sm tracking-tight overflow-hidden">
            <div className="h-5 w-5 bg-indigo-600 rounded-[4px] flex items-center justify-center shrink-0">
              <Command className="h-3 w-3 text-white" />
            </div>
            <span className="truncate">Radix Studio</span>
          </div>
        )}

        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-slate-400 hover:text-slate-600"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronsRight size={14} />
          ) : (
            <ChevronsLeft size={14} />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <div className="p-3 flex flex-col gap-2">
        <Button
          onClick={handleNewChat}
          className={cn(
            "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-zinc-800 transition-all",
            isCollapsed
              ? "w-full justify-center px-0 h-9"
              : "w-full justify-start gap-2 h-9",
          )}
          variant="ghost"
          title="New Interface"
        >
          <Plus size={14} className="text-indigo-500 shrink-0" />
          {!isCollapsed && (
            <span className="text-xs font-medium">New Interface</span>
          )}
        </Button>
      </div>

      {!isCollapsed && (
        <div className="px-4 py-2">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            History
          </h3>
        </div>
      )}

      {/* History List - Hide when collapsed to avoid clutter */}
      <ScrollArea className="flex-1 px-3">
        {!isCollapsed ? (
          <div className="space-y-[2px]">
            {data?.conversations.map((conv) => {
              const isActive = params.id === conv.id;
              return (
                <div key={conv.id} className="group relative flex items-center">
                  <button
                    className={cn(
                      "flex-1 text-left px-3 py-2 rounded-[6px] text-xs font-medium transition-colors truncate pr-8",
                      isActive
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50 hover:text-slate-900",
                    )}
                    onClick={() => router.push(`/conversation/${conv.id}`)}
                  >
                    {conv.title}
                  </button>

                  <button
                    className={cn(
                      "absolute right-2 p-1 rounded-sm opacity-0 transition-all text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20",
                      "group-hover:opacity-100",
                      isActive && "opacity-100",
                    )}
                    onClick={(e) => handleDelete(e, conv.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* Collapsed History Icons (Optional: could just hide) */
          <div className="flex flex-col gap-2 items-center mt-2">
            {data?.conversations.slice(0, 5).map((conv) => (
              <button
                key={conv.id}
                onClick={() => router.push(`/conversation/${conv.id}`)}
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded-md transition-colors",
                  params.id === conv.id
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-slate-400 hover:bg-slate-100 hover:text-slate-600",
                )}
                title={conv.title}
              >
                <MessageSquare size={14} />
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer Profile */}
      <div className="p-3 border-t border-slate-100 dark:border-zinc-800/50 mt-auto">
        <div
          className={cn(
            "flex items-center rounded-[6px] hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer",
            isCollapsed ? "justify-center p-2" : "gap-3 p-2",
          )}
          onClick={handleLogout}
          title="Sign out"
        >
          <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shrink-0" />
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                {user.email}
              </p>
            </div>
          )}
          {isCollapsed && <span className="sr-only">Sign out</span>}
        </div>
      </div>
    </div>
  );
}
