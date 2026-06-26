// src/components/agent/CallEndedNotice.tsx
//
// Confirmation shown when the agent has wrapped up the call, so the user knows
// the conversation has ended and what happens next (Aaron follows up).

"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const PINK = "#ea175c";

export function CallEndedNotice({ onRestart }: { onRestart: () => void }) {
  // Smoothly bring the notice into view — it mounts below the transcript, so
  // the transcript's own auto-scroll doesn't reach it. A short delay lets the
  // newly-mounted node lay out (and the entry animation start) before we scroll.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm"
    >
      {/* Pink brand logo — recolored via a CSS mask (no background), pops in. */}
      <motion.div
        role="img"
        aria-label="Mightybyte"
        initial={{ scale: 0, rotate: -18 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
        className="h-20 w-20"
        style={{
          backgroundColor: PINK,
          maskImage: "url(/logo.png)",
          WebkitMaskImage: "url(/logo.png)",
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.3, ease: "easeOut" }}
        className="space-y-1.5"
      >
        <h2 className="text-lg font-semibold text-white">Conversation ended</h2>
        <p className="text-sm leading-relaxed text-zinc-300">
          Thanks for taking the time.
        </p>
        <p className="text-sm leading-relaxed text-zinc-300">
          <strong>Aaron, AppMakers&rsquo; COO</strong>, will be in touch soon to
          schedule a consultation and talk through your project.
        </p>
      </motion.div>

      <motion.button
        type="button"
        onClick={onRestart}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="mt-1 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
      >
        Start a new conversation
      </motion.button>
    </motion.div>
  );
}
