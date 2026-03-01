import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contacts/contact-form";
import { MessageHistory } from "@/components/contacts/message-history";
import {
  formatDate,
  formatRelativeDate,
  getDaysOverdue,
  CATEGORY_COLORS,
} from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function ContactDetailPage({ params }: PageProps) {
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: {
      secondaryPhones: true,
      messages: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!contact) notFound();

  const daysOverdue = contact.nextDue
    ? getDaysOverdue(contact.nextDue)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/contacts"
          className="rounded-md p-2 transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{contact.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {contact.category && (
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                  CATEGORY_COLORS[contact.category] || "text-muted-foreground"
                }`}
              >
                {contact.category}
              </span>
            )}
            {contact.relationship && (
              <span className="text-xs text-muted-foreground">
                {contact.relationship}
              </span>
            )}
            {contact.kitActive && daysOverdue > 0 && (
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                {daysOverdue}d overdue
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Last Contact</p>
          <p className="text-sm font-medium">
            {formatRelativeDate(contact.lastContact)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Next Due</p>
          <p className="text-sm font-medium">
            {contact.kitActive
              ? formatDate(contact.nextDue)
              : "N/A"}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Frequency</p>
          <p className="text-sm font-medium">
            {contact.kitActive
              ? `Every ${contact.frequencyDays}d`
              : "Inactive"}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Messages</p>
          <p className="text-sm font-medium">{contact.messages.length}</p>
        </div>
      </div>

      {/* Edit Form */}
      <ContactForm contact={contact} />

      {/* Message History */}
      <MessageHistory messages={contact.messages} />
    </div>
  );
}
