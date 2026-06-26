// src/components/agent/ThinkingIndicator.tsx
//
// Grayish "Bay team thinking" progress, shown on the agent side of the
// transcript while a response is in flight but the agent hasn't started
// speaking yet. Three softly bouncing dots read as "working on it".

"use client";

import { motion } from "framer-motion";

const DOTS = [0, 1, 2];

export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-zinc-400">
      <div className="flex items-end gap-1">
        {DOTS.map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-zinc-500"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut" as const,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
      <span className="text-xs font-medium">Bay team thinking</span>
    </div>
  );
}
