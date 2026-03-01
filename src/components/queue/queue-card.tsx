"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getDaysOverdue,
  formatRelativeDate,
} from "@/lib/utils";
import { Clock, Send, SkipForward, Eye } from "lucide-react";

interface QueueContact {
  id: string;
  name: string;
  phone: string | null;
  frequencyDays: number;
  lastContact: Date | null;
  nextDue: Date | null;
  notes: string;
  category: string;
}

export function QueueCard({ contact }: { contact: QueueContact }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const daysOverdue = getDaysOverdue(contact.nextDue);

  const handleSnooze = async () => {
    setLoading(true);
    const newDue = new Date();
    newDue.setDate(newDue.getDate() + 7);
    await fetch(`/api/contacts/${contact.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nextDue: newDue.toISOString() }),
    });
    router.refresh();
    setLoading(false);
  };

  const handleMarkContacted = async () => {
    setLoading(true);
    await fetch(`/api/contacts/${contact.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastContact: new Date().toISOString() }),
    });
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/contacts/${contact.id}`}
            className="text-lg font-medium hover:underline"
          >
            {contact.name}
          </Link>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            Last: {formatRelativeDate(contact.lastContact)}
            <span className="text-xs">| Every {contact.frequencyDays}d</span>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            daysOverdue > 7
              ? "bg-red-500/20 text-red-400"
              : daysOverdue > 3
              ? "bg-orange-500/20 text-orange-400"
              : daysOverdue > 0
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-blue-500/20 text-blue-400"
          }`}
        >
          {daysOverdue > 0 ? `${daysOverdue}d overdue` : "Due today"}
        </span>
      </div>

      {contact.notes && (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
          {contact.notes}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/contacts/${contact.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent"
        >
          <Eye className="h-3 w-3" />
          View
        </Link>
        <button
          onClick={handleMarkContacted}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          <Send className="h-3 w-3" />
          Mark Contacted
        </button>
        <button
          onClick={handleSnooze}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-50"
        >
          <SkipForward className="h-3 w-3" />
          Snooze 7d
        </button>
      </div>
    </div>
  );
}
