// components/page-header.tsx
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/lib/schemas";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  containers: Container[];
  activeTab: string;
  setActiveTab: (tabId: string) => void;
  conversationTitle?: string;
  showMessagesTab?: boolean;
}

export function PageHeader({
  containers,
  activeTab,
  setActiveTab,
  conversationTitle,
  showMessagesTab = true,
}: PageHeaderProps) {
  return (
    <div className="border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-black px-4 h-14 flex items-center shrink-0 justify-between z-20">
      <TabsList className="bg-transparent h-auto p-0 gap-6">
        {showMessagesTab && (
          <TabsTrigger
            value="messages"
            className={cn(
              "data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-black dark:data-[state=active]:text-white border-b-2 border-transparent data-[state=active]:border-black dark:data-[state=active]:border-white px-2 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-all font-medium text-sm rounded-none cursor-pointer",
            )}
          >
            Messages
          </TabsTrigger>
        )}
        {containers.map((c) => (
          <TabsTrigger
            key={c.id}
            value={c.id}
            className={cn(
              "data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-black dark:data-[state=active]:text-white border-b-2 border-transparent data-[state=active]:border-black dark:data-[state=active]:border-white px-2 py-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-all font-medium text-sm rounded-none cursor-pointer",
            )}
          >
            {c.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {conversationTitle && (
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="font-normal text-slate-500 border-slate-200 dark:border-zinc-800 uppercase text-xs font-mono px-4 py-1 rounded-md"
          >
            {conversationTitle}
          </Badge>
        </div>
      )}
    </div>
  );
}
