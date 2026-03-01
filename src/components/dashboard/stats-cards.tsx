import { Users, Heart, MessageSquare, AlertCircle, RefreshCw } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";

interface StatsCardsProps {
  totalContacts: number;
  kitActiveCount: number;
  totalMessages: number;
  overdueCount: number;
  lastSync: Date | null;
}

export function StatsCards({
  totalContacts,
  kitActiveCount,
  totalMessages,
  overdueCount,
  lastSync,
}: StatsCardsProps) {
  const stats = [
    {
      label: "Total Contacts",
      value: totalContacts,
      icon: Users,
      color: "text-blue-400",
    },
    {
      label: "KIT Active",
      value: kitActiveCount,
      icon: Heart,
      color: "text-green-400",
    },
    {
      label: "Messages Sent",
      value: totalMessages,
      icon: MessageSquare,
      color: "text-purple-400",
    },
    {
      label: "Overdue",
      value: overdueCount,
      icon: AlertCircle,
      color: overdueCount > 0 ? "text-red-400" : "text-gray-400",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{stat.label}</span>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </div>
          <p className="mt-2 text-2xl font-bold">{stat.value}</p>
        </div>
      ))}
      <div className="col-span-full rounded-lg border border-border bg-card p-3 sm:col-span-2 lg:col-span-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          Last sync: {formatRelativeDate(lastSync)}
        </div>
      </div>
    </div>
  );
}
