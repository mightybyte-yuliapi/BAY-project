// src/components/agent/VoiceOrb.tsx
//
// The voice animation — Mightybyte themed (pink #ea175c on dark). Reacts to the
// agent's voice state with framer-motion:
//   - idle       → slow, calm breathe
//   - listening  → cool, steady pulse + expanding rings (receiving your voice)
//   - speaking   → energetic pulse + faster concentric ripples (outputting voice)
//
// Pure presentational — driven entirely by the `state` prop. The `compact` prop
// shrinks the orb for the pinned top bar; the shared `layoutId` lets framer
// smoothly animate it from the centered hero into the corner when a call starts.

"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { VoiceState } from "@/lib/realtime/events";

const PINK = "#ea175c";
const PINK_SOFT = "#ff4d85";

const LABEL: Record<VoiceState, string> = {
  idle: "",
  listening: "Listening",
  speaking: "Speaking",
};

// Expanding rings that emanate from the orb while it's active.
function Ripples({ active, speed }: { active: boolean; speed: number }) {
  // Rings only exist while active. When `active` flips false (e.g. the call
  // ended), they unmount immediately — no lingering animation.
  if (!active) return null;

  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute rounded-full border"
          // Inset so that even at max scale the ring stays within the orb area
          // and never reaches the controls below.
          style={{ borderColor: PINK, inset: "28%" }}
          initial={{ scale: 0.6, opacity: 0.55 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{
            duration: speed,
            repeat: Infinity,
            ease: "easeOut" as const,
            delay: (i * speed) / 3,
          }}
        />
      ))}
    </>
  );
}

export function VoiceOrb({
  state,
  compact = false,
}: {
  state: VoiceState;
  compact?: boolean;
}) {
  const listening = state === "listening";
  const speaking = state === "speaking";
  const active = listening || speaking;

  // Core orb motion per state.
  const coreAnim =
    state === "speaking"
      ? { scale: [1, 1.12, 0.96, 1.08, 1], transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" as const } }
      : state === "listening"
        ? { scale: [1, 1.06, 1], transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" as const } }
        : { scale: [1, 1.03, 1], transition: { duration: 3.4, repeat: Infinity, ease: "easeInOut" as const } };

  return (
    <div className="pointer-events-none flex flex-col items-center gap-5">
      {/* Fixed-size stage. No overflow clipping (that produced a hard square
          edge); instead the halo + ripples are sized/inset so they stay within
          this area. `layoutId` makes framer animate this box (size + position)
          smoothly when it moves between the hero and the pinned bar. */}
      <motion.div
        layoutId="voice-orb"
        transition={{ type: "spring", stiffness: 120, damping: 24, mass: 1.1 }}
        className={cn(
          "relative flex items-center justify-center",
          compact ? "h-12 w-12" : "h-48 w-48 sm:h-56 sm:w-56",
        )}
      >
        {/* Outer glow halo */}
        <motion.span
          className="pointer-events-none absolute rounded-full blur-2xl"
          style={{ inset: "14%", background: PINK }}
          animate={{
            opacity: active ? [0.35, 0.6, 0.35] : [0.18, 0.28, 0.18],
            scale: active ? [1, 1.08, 1] : [1, 1.04, 1],
          }}
          transition={{
            duration: speaking ? 0.9 : listening ? 1.6 : 3.4,
            repeat: Infinity,
            ease: "easeInOut" as const,
          }}
        />

        {/* Expanding rings while active — skipped in compact mode to keep the
            pinned bar tidy. */}
        <Ripples active={active && !compact} speed={speaking ? 1.1 : 1.8} />

        {/* Core orb */}
        <motion.div
          className={cn(
            "relative flex items-center justify-center rounded-full shadow-2xl",
            compact ? "h-10 w-10" : "h-28 w-28 sm:h-32 sm:w-32",
          )}
          style={{
            background: `radial-gradient(circle at 38% 30%, ${PINK_SOFT}, ${PINK} 52%, #8f0d39 100%)`,
            boxShadow: `0 0 60px -10px ${PINK}, inset 0 -8px 22px rgba(0,0,0,0.35)`,
          }}
          animate={coreAnim}
        >
          {/* Inner sheen highlight */}
          <span
            className="pointer-events-none absolute rounded-full opacity-50"
            style={{
              inset: "10%",
              background:
                "radial-gradient(circle at 35% 22%, rgba(255,255,255,0.65), transparent 50%)",
            }}
          />
          {/* Logo in the center — rendered white so it reads cleanly on pink */}
          <Image
            src="/logo.png"
            alt="Mightybyte"
            width={96}
            height={96}
            priority
            className={cn(
              "relative",
              compact ? "h-7 w-7" : "h-20 w-20 sm:h-24 sm:w-24",
            )}
            style={{
              filter: "brightness(0) invert(1) drop-shadow(0 1px 3px rgba(0,0,0,0.35))",
            }}
          />
        </motion.div>
      </motion.div>

      {!compact && LABEL[state] && (
        <motion.p
          key={state}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-medium tracking-wide text-zinc-300"
        >
          {LABEL[state]}
        </motion.p>
      )}
    </div>
  );
}
