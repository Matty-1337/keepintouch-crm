import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { contactId?: string };
}

export default async function MessagesPage({ searchParams }: PageProps) {
  const where: Record<string, unknown> = {};
  if (searchParams.contactId) {
    where.contactId = searchParams.contactId;
  }

  const messages = await prisma.message.findMany({
    where,
    include: { contact: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Messages</h1>

      {messages.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No messages yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/contacts/${msg.contactId}`}
                  className="font-medium hover:underline"
                >
                  {msg.contact.name}
                </Link>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      msg.status === "sent"
                        ? "bg-green-500/20 text-green-400"
                        : msg.status === "draft"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {msg.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(msg.sentAt || msg.createdAt)}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {msg.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
