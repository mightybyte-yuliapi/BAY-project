// src/components/agent/Agent.tsx
//
// Thin orchestrator. Pulls live state from the realtime hook and composes the
// modular UI pieces. No business logic lives here — it just wires + lays out.

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRealtimeAgent } from "@/lib/realtime/useRealtimeAgent";
import { VoiceOrb } from "./VoiceOrb";
import { MicButton } from "./MicButton";
import { MicSelect } from "./MicSelect";
import { ConnectionStatus } from "./ConnectionStatus";
import { TranscriptView } from "./TranscriptView";
import { CallEndedNotice } from "./CallEndedNotice";
import { ContactForm, isContactReady, type ContactInfo } from "./ContactForm";

export function Agent() {
  const {
    status,
    voiceState,
    thinking,
    transcript,
    error,
    connect,
    disconnect,
    micDevices,
    selectedMicId,
    setSelectedMicId,
    callEnded,
  } = useRealtimeAgent();
  // Tool calls are logged to the console by the hook, not shown in the UI.

  const [contact, setContact] = useState<ContactInfo>({ email: "", phone: "" });
  const contactReady = isContactReady(contact);
  const idle = status === "idle";
  const connecting = status === "connecting";
  const connected = status === "connected";

  const handleConnect = () =>
    connect({ email: contact.email.trim(), phone: contact.phone.trim() });

  // Turn indicators for the transcript:
  //  - thinking  → a response is in flight but the agent hasn't spoken yet.
  //  - listening → it's the user's turn (and the agent isn't mid-reply, i.e.
  //    not speaking and not still revealing its last bubble's text).
  const lastEntry = transcript[transcript.length - 1];
  const agentTyping =
    !!lastEntry &&
    lastEntry.role === "agent" &&
    (lastEntry.text?.length ?? 0) < (lastEntry.fullText?.length ?? 0);
  const showThinking = connected && thinking;
  const showListening =
    connected && !thinking && !agentTyping && voiceState !== "speaking";

  return (
    <>
      {/* Pinned top bar once connected — and kept as a header after the call
          ends. The orb glides up here (shared layoutId); the live status + End
          conversation button only show while a call is active. */}
      <AnimatePresence>
        {(connected || callEnded) && (
          <motion.header
            key="callbar"
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" as const }}
            className="fixed inset-x-0 top-0 z-50 flex items-center gap-4 border-b border-white/10 bg-[#15101a]/85 px-5 py-3 backdrop-blur-md"
          >
            <VoiceOrb state={voiceState} compact />
            {connected && (
              <div className="flex flex-1 items-center justify-end gap-4">
                <ConnectionStatus status={status} error={error} />
                <MicButton
                  status={status}
                  onConnect={handleConnect}
                  onDisconnect={disconnect}
                  compact
                />
              </div>
            )}
          </motion.header>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "m-auto flex w-full max-w-lg flex-col items-center gap-7 px-5 py-8 sm:py-10",
          (connected || callEnded) && "pt-24",
        )}
      >
        {/* Hero orb — centered until connected, then it glides into the top bar
            and stays there as the header (so it's hidden once a call ends too). */}
        {!connected && !callEnded && <VoiceOrb state={voiceState} />}

        {/* Connecting progress — centered while the session spins up. */}
        <AnimatePresence>
          {connecting && (
            <motion.div
              key="connecting"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.25, ease: "easeOut" as const }}
              className="flex items-center gap-2.5 text-sm font-medium text-zinc-300"
            >
              <Loader2 className="h-5 w-5 animate-spin text-[#ea175c]" />
              Connecting…
            </motion.div>
          )}
        </AnimatePresence>

        {/* Contact form — only before a call starts, and not after it ended;
            collapses away once talking so the live UI stays clean. */}
        <AnimatePresence initial={false}>
          {idle && !callEnded && (
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

        {/* Start control — idle pre-call only. Once connected the live controls
            move into the pinned bar; once ended the notice takes over below. */}
        {idle && !callEnded && (
          <div className="flex flex-col items-center gap-3">
            <MicButton
              status={status}
              onConnect={handleConnect}
              onDisconnect={disconnect}
              disabled={!contactReady}
            />
            <ConnectionStatus status={status} error={error} />
          </div>
        )}

        {/* Transcript — only meaningful once talking */}
        <AnimatePresence>
          {(connected || transcript.length > 0) && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <TranscriptView
                entries={transcript}
                voiceState={voiceState}
                listening={showListening}
                thinking={showThinking}
              />
            </motion.section>
          )}
        </AnimatePresence>

        {/* Call-ended notice — sits at the bottom, below the transcript. */}
        {callEnded && <CallEndedNotice onRestart={handleConnect} />}
      </div>
    </>
  );
}
