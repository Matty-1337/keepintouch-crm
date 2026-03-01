import { prisma } from "@/lib/prisma";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { OverdueList } from "@/components/dashboard/overdue-list";
import { CategoryChart } from "@/components/dashboard/category-chart";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const [
    totalContacts,
    kitActiveCount,
    totalMessages,
    overdueContacts,
    categoryBreakdown,
    lastSync,
  ] = await Promise.all([
    prisma.contact.count({ where: { archived: false } }),
    prisma.contact.count({ where: { kitActive: true, archived: false } }),
    prisma.message.count({ where: { status: "sent" } }),
    prisma.contact.findMany({
      where: {
        kitActive: true,
        archived: false,
        nextDue: { lte: new Date() },
      },
      orderBy: { nextDue: "asc" },
      take: 20,
    }),
    prisma.contact.groupBy({
      by: ["category"],
      where: { archived: false },
      _count: { id: true },
    }),
    prisma.syncLog.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  return {
    totalContacts,
    kitActiveCount,
    totalMessages,
    overdueContacts,
    categoryBreakdown: categoryBreakdown.map((c) => ({
      name: c.category || "Uncategorized",
      count: c._count.id,
    })),
    lastSync: lastSync?.createdAt ?? null,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <StatsCards
        totalContacts={data.totalContacts}
        kitActiveCount={data.kitActiveCount}
        totalMessages={data.totalMessages}
        overdueCount={data.overdueContacts.length}
        lastSync={data.lastSync}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <OverdueList contacts={data.overdueContacts} />
        <CategoryChart data={data.categoryBreakdown} />
      </div>
    </div>
  );
}
