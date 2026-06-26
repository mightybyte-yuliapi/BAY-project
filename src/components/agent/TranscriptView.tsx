// src/components/agent/TranscriptView.tsx
//
// Renders the running conversation transcript. Single-purpose: presentational
// list of transcript entries.

import { cn } from "@/lib/utils";
import type { TranscriptEntry } from "@/lib/realtime/useRealtimeAgent";

export function TranscriptView({ entries }: { entries: TranscriptEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        The conversation transcript will appear here.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {entries.map((e) => (
        <div
          key={e.id}
          className={cn(
            "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
            e.role === "user"
              ? "self-end bg-violet-600 text-white"
              : "self-start bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
          )}
        >
          {e.text}
        </div>
      ))}
    </div>
  );
}
