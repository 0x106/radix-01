"use client";

import { db } from "@/lib/instant";
import { id } from "@instantdb/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, LogOut } from "lucide-react";
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

  const handleLogout = () => {
    db.auth.signOut();
  };

  return (
    <div className="w-64 border-r bg-zinc-50 dark:bg-zinc-900 flex flex-col h-full">
      <div className="p-4 border-b">
        <Button onClick={handleNewChat} className="w-full justify-start gap-2">
          <Plus size={16} /> New Conversation
        </Button>
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {data?.conversations.map((conv) => (
            <Button
              key={conv.id}
              variant={params.id === conv.id ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-2 font-normal truncate",
                params.id === conv.id && "bg-slate-200 dark:bg-zinc-800",
              )}
              onClick={() => router.push(`/conversation/${conv.id}`)}
            >
              <MessageSquare size={14} className="text-muted-foreground" />
              <span className="truncate">{conv.title}</span>
            </Button>
          ))}
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
