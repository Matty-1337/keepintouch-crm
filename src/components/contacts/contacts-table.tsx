import Link from "next/link";
import {
  getDaysOverdue,
  formatRelativeDate,
  CATEGORY_COLORS,
} from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  category: string;
  relationship: string;
  frequencyDays: number;
  lastContact: Date | null;
  nextDue: Date | null;
  kitActive: boolean;
}

export function ContactsTable({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">No contacts found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              Name
            </th>
            <th className="hidden px-4 py-3 text-left text-sm font-medium text-muted-foreground sm:table-cell">
              Category
            </th>
            <th className="hidden px-4 py-3 text-left text-sm font-medium text-muted-foreground md:table-cell">
              Frequency
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              Last Contact
            </th>
            <th className="hidden px-4 py-3 text-left text-sm font-medium text-muted-foreground sm:table-cell">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {contacts.map((contact) => {
            const daysOverdue = contact.nextDue
              ? getDaysOverdue(contact.nextDue)
              : 0;
            const isOverdue = contact.kitActive && daysOverdue > 0;

            return (
              <tr
                key={contact.id}
                className="transition-colors hover:bg-accent/50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="font-medium hover:underline"
                  >
                    {contact.name}
                  </Link>
                  <p className="text-xs text-muted-foreground sm:hidden">
                    {contact.category || "—"}
                  </p>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  {contact.category ? (
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                        CATEGORY_COLORS[contact.category] || "text-muted-foreground"
                      }`}
                    >
                      {contact.category}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-sm md:table-cell">
                  {contact.kitActive ? `${contact.frequencyDays}d` : "—"}
                </td>
                <td className="px-4 py-3 text-sm">
                  {formatRelativeDate(contact.lastContact)}
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  {contact.kitActive ? (
                    isOverdue ? (
                      <span className="inline-flex rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                        {daysOverdue}d overdue
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                        On track
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Inactive
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
