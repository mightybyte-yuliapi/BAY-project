// src/components/agent/VoiceOrb.tsx
//
// The voice animation. A pulsing orb that reacts to the agent's voice state:
//   - listening  → cool blue, gentle pulse (receiving the user's voice)
//   - speaking   → warm violet, faster pulse (outputting voice)
//   - idle       → calm, slow breathe
//
// Pure presentational component — driven entirely by the `state` prop.

import { cn } from "@/lib/utils";
import type { VoiceState } from "@/lib/realtime/events";

const STATE_STYLES: Record<
  VoiceState,
  { ring: string; label: string; pulse: string }
> = {
  idle: {
    ring: "bg-zinc-400/40",
    label: "Idle",
    pulse: "animate-[breathe_3s_ease-in-out_infinite]",
  },
  listening: {
    ring: "bg-sky-500/50",
    label: "Listening…",
    pulse: "animate-[pulse-fast_1.1s_ease-in-out_infinite]",
  },
  speaking: {
    ring: "bg-violet-500/60",
    label: "Speaking…",
    pulse: "animate-[pulse-fast_0.7s_ease-in-out_infinite]",
  },
};

export function VoiceOrb({ state }: { state: VoiceState }) {
  const s = STATE_STYLES[state];
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex h-40 w-40 items-center justify-center">
        {/* Outer animated halo */}
        <span
          className={cn(
            "absolute inset-0 rounded-full blur-xl",
            s.ring,
            s.pulse,
          )}
        />
        {/* Core orb */}
        <span
          className={cn(
            "relative h-24 w-24 rounded-full bg-gradient-to-br shadow-lg transition-colors duration-500",
            state === "speaking"
              ? "from-violet-400 to-violet-600"
              : state === "listening"
                ? "from-sky-400 to-sky-600"
                : "from-zinc-300 to-zinc-500",
          )}
        />
      </div>
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
        {s.label}
      </p>
    </div>
  );
}
