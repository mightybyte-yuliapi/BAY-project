// src/components/agent/TranscriptView.tsx
//
// Renders the running conversation transcript. Single-purpose: presentational
// list of transcript entries, themed dark with brand-pink user bubbles.

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { TranscriptEntry } from "@/lib/realtime/useRealtimeAgent";

export function TranscriptView({ entries }: { entries: TranscriptEntry[] }) {
  // Hide placeholder bubbles that have no text yet (created in-order on
  // conversation.item.added, filled once transcription/deltas arrive).
  entries = entries.filter((e) => e.text.trim().length > 0);

  if (entries.length === 0) {
    return (
      <p className="text-center text-sm text-zinc-500">
        Your conversation will appear here.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2.5">
      <AnimatePresence initial={false}>
        {entries.map((e) => (
          <motion.div
            key={e.id}
            layout
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              e.role === "user"
                ? "self-end bg-[#ea175c] text-white shadow-[0_4px_20px_-6px_rgba(234,23,92,0.7)]"
                : "self-start border border-white/10 bg-white/5 text-zinc-100 backdrop-blur-sm",
            )}
          >
            {e.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
