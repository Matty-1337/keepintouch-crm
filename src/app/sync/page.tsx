import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { RefreshCw, ArrowUp, ArrowDown, Check, X } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SyncPage() {
  const syncLogs = await prisma.syncLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const lastSync = syncLogs[0] ?? null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Sync Status</h1>

      {/* Current Status */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">
              Last Sync: {lastSync ? formatDate(lastSync.createdAt) : "Never"}
            </p>
            {lastSync && (
              <p className="text-sm text-muted-foreground">
                {lastSync.direction} from {lastSync.source} — {lastSync.contacts}{" "}
                contacts — {lastSync.status}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sync Log */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Sync History</h2>
        {syncLogs.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-muted-foreground">No sync history yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {syncLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 rounded-md border border-border p-3"
              >
                {log.direction === "push" ? (
                  <ArrowUp className="h-4 w-4 text-blue-400" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-green-400" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {log.direction.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      from {log.source}
                    </span>
                    {log.status === "success" ? (
                      <Check className="h-3 w-3 text-green-400" />
                    ) : (
                      <X className="h-3 w-3 text-red-400" />
                    )}
                  </div>
                  {log.details && (
                    <p className="text-xs text-muted-foreground">
                      {log.details}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {log.contacts} contacts
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(log.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
