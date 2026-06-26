// src/components/agent/TranscriptView.tsx
//
// Renders the running conversation transcript. Single-purpose: presentational
// list of transcript entries, themed dark with brand-pink user bubbles. While
// it's the user's turn, a small listening indicator stands in as the client's
// pending message bubble at the bottom.

"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { VoiceActivity } from "./VoiceActivity";
import { ThinkingIndicator } from "./ThinkingIndicator";
import type { TranscriptEntry } from "@/lib/realtime/useRealtimeAgent";
import type { VoiceState } from "@/lib/realtime/events";

export function TranscriptView({
  entries,
  voiceState = "idle",
  listening = false,
  thinking = false,
}: {
  entries: TranscriptEntry[];
  voiceState?: VoiceState;
  listening?: boolean;
  thinking?: boolean;
}) {
  // Hide placeholder bubbles that have no text yet (created in-order on
  // conversation.item.added, filled once transcription/deltas arrive).
  entries = entries.filter((e) => e.text.trim().length > 0);

  // Smoothly keep the latest message in view. Re-runs whenever a new bubble is
  // added, the latest one grows as deltas stream in, or the listening indicator
  // appears/disappears.
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastEntry = entries[entries.length - 1];
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length, lastEntry?.text, listening, thinking]);

  if (entries.length === 0 && !listening && !thinking) {
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

        {/* Listening indicator — where the client's next message will land
            (right side), bare (no bubble). */}
        {listening && (
          <motion.div
            key="listening"
            layout
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="self-end px-1 py-1.5"
          >
            <VoiceActivity state={voiceState} />
          </motion.div>
        )}

        {/* "Bay team thinking" — agent side (left), while awaiting a response. */}
        {thinking && (
          <motion.div
            key="thinking"
            layout
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="self-start px-1 py-1.5"
          >
            <ThinkingIndicator />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll anchor — keeps the newest message in view. */}
      <div ref={bottomRef} />
    </div>
  );
}
