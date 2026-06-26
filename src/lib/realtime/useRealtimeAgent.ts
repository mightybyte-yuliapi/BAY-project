// src/lib/realtime/useRealtimeAgent.ts
//
// The WebRTC client for the Realtime agent. Responsibilities:
//   - mint an ephemeral token (server state, via React Query)
//   - open a WebRTC peer connection directly to OpenAI
//   - stream mic audio up, play model audio down
//   - process the data-channel event stream into local voice state
//   - relay model function calls to the backend, return results to the model
//
// Audio never touches our backend (lowest latency). Only the token and tool
// execution go through our server.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeSession } from "@/lib/queries/useRealtimeSession";
import { useToolCall } from "@/lib/queries/useToolCall";
import {
  ClientEvent,
  ServerEvent,
  extractFunctionCalls,
  type VoiceState,
} from "./events";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error";

export type TranscriptEntry = {
  id: string;
  role: "user" | "agent";
  text: string;
};

export type ToolEvent = {
  callId: string;
  name: string;
  status: "running" | "done" | "error";
};

const REALTIME_URL = "https://api.openai.com/v1/realtime/calls";

export function useRealtimeAgent() {
  const session = useRealtimeSession();
  const toolCall = useToolCall();

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Available microphones + the one the user picked.
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");

  // List input devices (labels require a prior permission grant).
  const refreshDevices = useCallback(async () => {
    try {
      // Trigger a permission prompt so device labels are populated.
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop());
    } catch {
      /* user may deny; we still try to enumerate */
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter((d) => d.kind === "audioinput");
    setMicDevices(mics);
    // Default to the first NON-virtual mic (skip Zoom/virtual devices).
    setSelectedMicId((cur) => {
      if (cur && mics.some((m) => m.deviceId === cur)) return cur;
      const real = mics.find((m) => !/virtual|zoom/i.test(m.label));
      return (real ?? mics[0])?.deviceId ?? "";
    });
  }, []);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Lets handleFunctionCall trigger disconnect without a circular dependency.
  const endCallRef = useRef<(() => void) | null>(null);

  // Send a JSON event to the model over the data channel.
  const send = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (dc?.readyState === "open") dc.send(JSON.stringify(event));
  }, []);

  // Run a model function call on our backend and feed the result back.
  const handleFunctionCall = useCallback(
    async (call: { name: string; call_id: string; arguments: string }) => {
      setToolEvents((prev) => [
        ...prev,
        { callId: call.call_id, name: call.name, status: "running" },
      ]);
      let output: unknown;
      let ok = true;
      try {
        const args = call.arguments ? JSON.parse(call.arguments) : {};
        const res = await toolCall.mutateAsync({ name: call.name, arguments: args });
        output = res.result;
      } catch (err) {
        ok = false;
        output = { error: err instanceof Error ? err.message : "Tool failed." };
      }
      setToolEvents((prev) =>
        prev.map((t) =>
          t.callId === call.call_id
            ? { ...t, status: ok ? "done" : "error" }
            : t,
        ),
      );
      // Return the result to the model, then ask it to continue speaking.
      send({
        type: ClientEvent.CreateConversationItem,
        item: {
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(output),
        },
      });
      send({ type: ClientEvent.CreateResponse });

      // end_call means the report was filed — let the agent say its goodbye,
      // then tear down the session.
      if (call.name === "end_call" && ok) {
        setTimeout(() => endCallRef.current?.(), 8000);
      }
    },
    [send, toolCall],
  );

  // Handle one server event from the data channel.
  const handleServerEvent = useCallback(
    (event: { type: string } & Record<string, unknown>) => {
      switch (event.type) {
        case ServerEvent.SpeechStarted:
          setVoiceState("listening");
          break;
        case ServerEvent.SpeechStopped:
          setVoiceState((s) => (s === "listening" ? "idle" : s));
          break;
        case ServerEvent.OutputAudioDelta:
          setVoiceState("speaking");
          break;
        case ServerEvent.OutputAudioDone:
          setVoiceState("idle");
          break;
        case ServerEvent.OutputTranscriptDelta: {
          const delta = (event as { delta?: string }).delta ?? "";
          setTranscript((prev) => appendDelta(prev, "agent", delta));
          break;
        }
        case ServerEvent.InputTranscriptCompleted: {
          const text = (event as { transcript?: string }).transcript ?? "";
          if (text) {
            setTranscript((prev) => [
              ...prev,
              { id: cryptoId(), role: "user", text },
            ]);
          }
          break;
        }
        case ServerEvent.ResponseDone: {
          for (const call of extractFunctionCalls(event)) {
            void handleFunctionCall(call);
          }
          break;
        }
      }
    },
    [handleFunctionCall],
  );

  const connect = useCallback(async () => {
    if (status === "connecting" || status === "connected") return;
    setError(null);
    setStatus("connecting");
    try {
      // 1. Mint an ephemeral token from our backend.
      const { clientSecret } = await session.mutateAsync();
      const ephemeralKey = clientSecret.value;

      // 2. Set up the peer connection + audio playback element.
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = new Audio();
      audioEl.autoplay = true;
      audioRef.current = audioEl;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      // 3. Capture mic and add the track. Request echo cancellation / noise
      //    suppression for clean voice. (Device is chosen by the browser's
      //    site settings — make sure it's a REAL mic, not a virtual one like
      //    ZoomAudioDevice, which outputs silence.)
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Use the explicitly selected mic if we have one (avoids the
          // browser defaulting to a silent virtual device like Zoom).
          ...(selectedMicId ? { deviceId: { exact: selectedMicId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micRef.current = mic;
      pc.addTrack(mic.getTracks()[0], mic);

      // 4. Data channel carries the event stream (transcripts, tools, state).
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("open", () => {
        // Ensure turn detection + transcription are active for this session.
        dc.send(
          JSON.stringify({
            type: ClientEvent.SessionUpdate,
            session: {
              type: "realtime",
              audio: {
                input: {
                  turn_detection: {
                    type: "semantic_vad",
                    eagerness: "low",
                    create_response: true,
                    interrupt_response: true,
                  },
                  transcription: { model: "gpt-4o-transcribe" },
                },
              },
            },
          }),
        );
      });
      dc.addEventListener("message", (e) => {
        try {
          const evt = JSON.parse(e.data);
          if (evt.type === "error") console.error("[agent] server error:", evt);
          handleServerEvent(evt);
        } catch {
          /* ignore malformed events */
        }
      });

      // 5. Offer/answer SDP exchange with OpenAI, authed by the ephemeral key.
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(REALTIME_URL, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
      });
      if (!sdpRes.ok) {
        const body = await sdpRes.text();
        throw new Error(`WebRTC negotiation failed (${sdpRes.status}): ${body}`);
      }

      await pc.setRemoteDescription({
        type: "answer",
        sdp: await sdpRes.text(),
      });

      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "connected") setStatus("connected");
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          setStatus("error");
          setError("Connection lost.");
        }
      });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to connect.");
      cleanup();
    }
  }, [status, session, handleServerEvent, selectedMicId]);

  const cleanup = useCallback(() => {
    dcRef.current?.close();
    micRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    dcRef.current = null;
    micRef.current = null;
    pcRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setStatus("idle");
    setVoiceState("idle");
  }, [cleanup]);

  // Keep the ref pointing at the latest disconnect for end_call teardown.
  endCallRef.current = disconnect;

  // Enumerate mics on mount, and re-list when devices change.
  useEffect(() => {
    void refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () =>
      navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
  }, [refreshDevices]);

  // Tear down on unmount.
  useEffect(() => cleanup, [cleanup]);

  return {
    status,
    voiceState,
    transcript,
    toolEvents,
    error,
    connect,
    disconnect,
    isConnected: status === "connected",
    // Mic device selection.
    micDevices,
    selectedMicId,
    setSelectedMicId,
    refreshDevices,
  };
}

// Append a streaming transcript delta to the last agent entry (or start one).
function appendDelta(
  prev: TranscriptEntry[],
  role: "agent",
  delta: string,
): TranscriptEntry[] {
  const last = prev[prev.length - 1];
  if (last && last.role === role) {
    return [...prev.slice(0, -1), { ...last, text: last.text + delta }];
  }
  return [...prev, { id: cryptoId(), role, text: delta }];
}

function cryptoId(): string {
  return crypto.randomUUID();
}
