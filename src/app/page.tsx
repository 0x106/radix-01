"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/instant";
import { id } from "@instantdb/react";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { user } = db.useAuth();
  const { data, isLoading } = db.useQuery({
    conversations: {
      $: {
        where: { "owner.id": user?.id },
        order: { createdAt: "desc" },
        limit: 1,
      },
    },
  });

  useEffect(() => {
    if (isLoading || !user) return;

    if (data?.conversations && data.conversations.length > 0) {
      // Redirect to most recent conversation
      router.push(`/conversation/${data.conversations[0].id}`);
    } else {
      // Create new one if none exist
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
    }
  }, [isLoading, data, user, router]);

  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
