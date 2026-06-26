// src/components/agent/Agent.tsx
//
// Thin orchestrator. Pulls live state from the realtime hook and composes the
// modular UI pieces. No business logic lives here — it just wires.

"use client";

import { useRealtimeAgent } from "@/lib/realtime/useRealtimeAgent";
import { VoiceOrb } from "./VoiceOrb";
import { MicButton } from "./MicButton";
import { MicSelect } from "./MicSelect";
import { ConnectionStatus } from "./ConnectionStatus";
import { TranscriptView } from "./TranscriptView";
import { ToolActivity } from "./ToolActivity";

export function Agent() {
  const {
    status,
    voiceState,
    transcript,
    toolEvents,
    error,
    connect,
    disconnect,
    micDevices,
    selectedMicId,
    setSelectedMicId,
  } = useRealtimeAgent();

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-8">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Mightybyte Agent
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Voice-to-voice assistant</p>
      </header>

      <VoiceOrb state={voiceState} />

      <MicSelect
        devices={micDevices}
        selectedId={selectedMicId}
        onChange={setSelectedMicId}
        disabled={status === "connected" || status === "connecting"}
      />

      <MicButton
        status={status}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      <ConnectionStatus status={status} error={error} />

      <ToolActivity events={toolEvents} />

      <section className="min-h-24 w-full">
        <TranscriptView entries={transcript} />
      </section>
    </div>
  );
}
