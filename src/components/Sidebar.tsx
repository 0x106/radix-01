"use client";

import { db } from "@/lib/instant";
import { id } from "@instantdb/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, LogOut, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar({ user }: { user: any }) {
  const router = useRouter();
  const params = useParams();
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
          title: "New Conversation",
          createdAt: Date.now(),
        })
        .link({ owner: user.id }),
    );
    router.push(`/conversation/${newId}`);
  };

  const handleDelete = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation(); // Prevent navigation click

    if (confirm("Are you sure you want to delete this conversation?")) {
      db.transact(db.tx.conversations[convId].delete());

      // If we deleted the active conversation, go home
      if (params.id === convId) {
        router.push("/");
      }
    }
  };

  const handleLogout = () => {
    db.auth.signOut();
  };

  return (
    <div className="w-64 border-r bg-zinc-50 dark:bg-zinc-900 flex flex-col h-full shrink-0">
      <div className="p-4 border-b">
        <Button onClick={handleNewChat} className="w-full justify-start gap-2">
          <Plus size={16} /> New Conversation
        </Button>
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {data?.conversations.map((conv) => {
            const isActive = params.id === conv.id;

            return (
              <div
                key={conv.id}
                className="group flex items-center gap-1 pr-1 relative"
              >
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "flex-1 justify-start gap-2 font-normal truncate pr-8", // Add padding for the delete button
                    isActive && "bg-slate-200 dark:bg-zinc-800",
                  )}
                  onClick={() => router.push(`/conversation/${conv.id}`)}
                >
                  <MessageSquare
                    size={14}
                    className="text-muted-foreground shrink-0"
                  />
                  <span className="truncate">{conv.title}</span>
                </Button>

                {/* Delete Button - visible on hover or if active */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-6 w-6 absolute right-2 opacity-0 transition-opacity text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20",
                    "group-hover:opacity-100",
                    isActive && "opacity-100", // Always show on active tab for better UX
                  )}
                  onClick={(e) => handleDelete(e, conv.id)}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-4 border-t mt-auto">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground truncate max-w-[120px]">
            {user.email}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Sign Out"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
