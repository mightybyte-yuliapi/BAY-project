// src/components/agent/ToolActivity.tsx
//
// Shows tool calls as they fire and resolve. Single-purpose presentational
// component, useful for demoing/debugging that backend tools are running.

import { Loader2, Check, X, Wrench } from "lucide-react";
import type { ToolEvent } from "@/lib/realtime/useRealtimeAgent";

export function ToolActivity({ events }: { events: ToolEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
        <Wrench className="h-3.5 w-3.5" /> Tool activity
      </p>
      {events.map((e) => (
        <div
          key={e.callId}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-800"
        >
          {e.status === "running" && (
            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
          )}
          {e.status === "done" && <Check className="h-4 w-4 text-emerald-500" />}
          {e.status === "error" && <X className="h-4 w-4 text-red-500" />}
          <code className="text-zinc-700 dark:text-zinc-300">{e.name}</code>
        </div>
      ))}
    </div>
  );
}
