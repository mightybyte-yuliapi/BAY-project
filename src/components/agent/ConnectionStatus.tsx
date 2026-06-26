// src/components/agent/ConnectionStatus.tsx
//
// Small status pill. Single-purpose: shows the connection state (and error).

import { cn } from "@/lib/utils";
import type { ConnectionStatus as Status } from "@/lib/realtime/useRealtimeAgent";

const LABELS: Record<Status, { text: string; dot: string }> = {
  idle: { text: "Not connected", dot: "bg-zinc-400" },
  connecting: { text: "Connecting", dot: "bg-amber-400 animate-pulse" },
  connected: { text: "Connected", dot: "bg-emerald-500" },
  error: { text: "Error", dot: "bg-red-500" },
};

export function ConnectionStatus({
  status,
  error,
}: {
  status: Status;
  error?: string | null;
}) {
  // Idle is the default resting state — no need to advertise "Not connected".
  if (status === "idle") return null;

  const s = LABELS[status];
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
      <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} />
      <span>{error && status === "error" ? error : s.text}</span>
    </div>
  );
}
