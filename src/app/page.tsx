"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/instant";
import { id } from "@instantdb/react";
import { Flower2, Loader2, Pizza } from "lucide-react";

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
    }
  }, [isLoading, data, user, router]);

  return (
    <div className="flex h-full items-center justify-center flex-col gap-10">
      <Flower2 className="h-8 w-8" />
      <span className="uppercase font-mono">
        Create a new conversation to get started.
      </span>
    </div>
  );
}
