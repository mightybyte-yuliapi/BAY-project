// src/components/agent/CallEndedNotice.tsx
//
// Confirmation shown when the agent has wrapped up the call, so the user knows
// the conversation has ended and what happens next (Aaron follows up).

"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

export function CallEndedNotice({ onRestart }: { onRestart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm"
    >
      <CheckCircle2 className="h-10 w-10 text-[#ea175c]" />
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-white">Conversation ended</h2>
        <p className="text-sm leading-relaxed text-zinc-300">
          Thanks for taking the time. <strong>Aaron, AppMakers&rsquo; COO</strong>,
          will be in touch soon to schedule a consultation and talk through your
          project.
        </p>
      </div>
      <button
        type="button"
        onClick={onRestart}
        className="mt-1 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
      >
        Start a new conversation
      </button>
    </motion.div>
  );
}
