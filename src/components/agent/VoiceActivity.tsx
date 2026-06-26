// src/components/agent/VoiceActivity.tsx
//
// Small animated equalizer + label that signals whose turn it is. Rendered as
// the client's "pending message" bubble at the bottom of the transcript:
//   - idle (during a call) → gently breathing bars, "Listening…" (your turn)
//   - listening            → lively bars, "Listening…" (you're talking)
//   - speaking             → lively bars, "Speaking" (agent is talking)

"use client";

import { motion } from "framer-motion";
import type { VoiceState } from "@/lib/realtime/events";

const BARS = [0, 1, 2, 3, 4];

export function VoiceActivity({
  state,
  color = "#ea175c",
  showLabel = true,
}: {
  state: VoiceState;
  color?: string;
  showLabel?: boolean;
}) {
  const speaking = state === "speaking";
  const listening = state === "listening";
  const active = speaking || listening;

  // Bars are energetic while someone is actually talking, and settle into a
  // calm "I'm here, go ahead" breathe while waiting for the user.
  const lo = active ? 0.35 : 0.45;
  const hi = active ? 1 : 0.7;
  const duration = speaking ? 0.5 : listening ? 0.6 : 1.5;

  const label = speaking ? "Speaking" : "Listening…";

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-3.5 items-end gap-[2px]">
        {BARS.map((i) => (
          <motion.span
            key={i}
            className="w-[3px] rounded-full"
            style={{ background: color, height: "100%", transformOrigin: "bottom" }}
            animate={{ scaleY: [lo, hi, lo] }}
            transition={{
              duration,
              repeat: Infinity,
              ease: "easeInOut" as const,
              // Center bars lead, edges trail — reads like a soft waveform.
              delay: (Math.abs(i - 2) * duration) / 6,
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-xs font-medium" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  );
}
