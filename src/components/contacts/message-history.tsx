import { formatDate } from "@/lib/utils";

interface Message {
  id: string;
  message: string;
  status: string;
  sentAt: Date | null;
  createdAt: Date;
}

export function MessageHistory({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 font-medium">Message History</h3>
        <p className="text-sm text-muted-foreground">No messages yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-4 font-medium">
        Message History ({messages.length})
      </h3>
      <div className="space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="rounded-md border border-border p-3"
          >
            <div className="mb-1 flex items-center gap-2">
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
            <p className="text-sm">{msg.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
