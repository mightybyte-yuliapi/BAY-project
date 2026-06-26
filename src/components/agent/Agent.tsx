// src/components/agent/Agent.tsx
//
// Thin orchestrator. Pulls live state from the realtime hook and composes the
// modular UI pieces. No business logic lives here — it just wires + lays out.

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRealtimeAgent } from "@/lib/realtime/useRealtimeAgent";
import { VoiceOrb } from "./VoiceOrb";
import { MicButton } from "./MicButton";
import { MicSelect } from "./MicSelect";
import { ConnectionStatus } from "./ConnectionStatus";
import { TranscriptView } from "./TranscriptView";
import { ContactForm, isContactReady, type ContactInfo } from "./ContactForm";

export function Agent() {
  const {
    status,
    voiceState,
    transcript,
    error,
    connect,
    disconnect,
    micDevices,
    selectedMicId,
    setSelectedMicId,
  } = useRealtimeAgent();
  // Tool calls are logged to the console by the hook, not shown in the UI.

  const [contact, setContact] = useState<ContactInfo>({ email: "", phone: "" });
  const contactReady = isContactReady(contact);
  const idle = status === "idle";
  const busy = status === "connected" || status === "connecting";

  const handleConnect = () =>
    connect({ email: contact.email.trim(), phone: contact.phone.trim() });

  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-7 px-5 py-8 sm:py-10">
      {/* Brand header */}
      <header className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Bay Watch
        </h1>
        <p className="text-sm text-zinc-400">AppMakers · AI lead assistant</p>
      </header>

      {/* Orb */}
      <VoiceOrb state={voiceState} />

      {/* Contact form — only before a call starts; collapses away once talking
          so the live UI stays clean. */}
      <AnimatePresence initial={false}>
        {idle && (
          <motion.div
            key="contact"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" as const }}
            className="w-full overflow-hidden"
          >
            <div className="flex w-full flex-col items-center gap-4">
              <ContactForm value={contact} onChange={setContact} />
              <MicSelect
                devices={micDevices}
                selectedId={selectedMicId}
                onChange={setSelectedMicId}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary control + connection status */}
      <div className="flex flex-col items-center gap-3">
        <MicButton
          status={status}
          onConnect={handleConnect}
          onDisconnect={disconnect}
          disabled={!contactReady}
        />
        <ConnectionStatus status={status} error={error} />
      </div>

      {/* Transcript — only meaningful once talking */}
      <AnimatePresence>
        {(busy || transcript.length > 0) && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <TranscriptView entries={transcript} />
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
