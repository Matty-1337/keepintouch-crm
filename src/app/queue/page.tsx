import { prisma } from "@/lib/prisma";
import { QueueCard } from "@/components/queue/queue-card";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const dueContacts = await prisma.contact.findMany({
    where: {
      kitActive: true,
      archived: false,
      nextDue: { lte: new Date() },
    },
    orderBy: { nextDue: "asc" },
  });

  const upcomingContacts = await prisma.contact.findMany({
    where: {
      kitActive: true,
      archived: false,
      nextDue: {
        gt: new Date(),
        lte: new Date(Date.now() + 7 * 86400000),
      },
    },
    orderBy: { nextDue: "asc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Queue</h1>

      {/* Overdue + Due Today */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-red-400">
          Due Now ({dueContacts.length})
        </h2>
        {dueContacts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-muted-foreground">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dueContacts.map((contact) => (
              <QueueCard key={contact.id} contact={contact} />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming */}
      {upcomingContacts.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-muted-foreground">
            Coming Up (Next 7 Days)
          </h2>
          <div className="space-y-3">
            {upcomingContacts.map((contact) => (
              <QueueCard key={contact.id} contact={contact} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
