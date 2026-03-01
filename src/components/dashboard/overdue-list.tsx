import Link from "next/link";
import { getDaysOverdue, formatRelativeDate } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  nextDue: Date | null;
  lastContact: Date | null;
  frequencyDays: number;
  category: string;
}

export function OverdueList({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Overdue Contacts</h2>
        <p className="text-sm text-muted-foreground">
          All caught up! No overdue contacts.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold">
        Overdue Contacts ({contacts.length})
      </h2>
      <div className="space-y-3">
        {contacts.map((contact) => {
          const daysOverdue = getDaysOverdue(contact.nextDue);
          return (
            <Link
              key={contact.id}
              href={`/contacts/${contact.id}`}
              className="flex items-center justify-between rounded-md border border-border p-3 transition-colors hover:bg-accent"
            >
              <div>
                <p className="font-medium">{contact.name}</p>
                <p className="text-xs text-muted-foreground">
                  Last: {formatRelativeDate(contact.lastContact)} | Every{" "}
                  {contact.frequencyDays}d
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  daysOverdue > 7
                    ? "bg-red-500/20 text-red-400"
                    : daysOverdue > 3
                    ? "bg-orange-500/20 text-orange-400"
                    : "bg-yellow-500/20 text-yellow-400"
                }`}
              >
                {daysOverdue}d overdue
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
