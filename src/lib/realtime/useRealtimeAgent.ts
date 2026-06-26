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
  // For agent entries: the Realtime item_id this bubble belongs to, so deltas
  // for one response stay together and a new response starts a new bubble.
  itemId?: string;
};


const REALTIME_URL = "https://api.openai.com/v1/realtime/calls";

export function useRealtimeAgent() {
  const session = useRealtimeSession();
  const toolCall = useToolCall();

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
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
  // Post-call finalize (email the briefing). Ref so unload/event handlers and
  // handleFunctionCall can call it without dependency cycles.
  const finalizeRef = useRef<((reason: "completed" | "abandoned") => void) | null>(null);
  // Latest transcript, mirrored into a ref so sendBeacon can read it on unload.
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  // Guard: a call is finalized exactly once (avoids double emails when the
  // agent's end_call is followed by teardown/unload).
  const finalizedRef = useRef(false);
  // The lead's contact info (captured by ContactForm before the call), kept so
  // the finalize briefing can include it.
  const contactRef = useRef<{ email?: string; phone?: string }>({});

  // Send a JSON event to the model over the data channel.
  const send = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (dc?.readyState === "open") dc.send(JSON.stringify(event));
  }, []);

  // Run a model function call on our backend and feed the result back.
  // Tool calls are logged to the console only — not surfaced in the UI.
  const handleFunctionCall = useCallback(
    async (call: { name: string; call_id: string; arguments: string }) => {
      console.log(`[tool] → ${call.name}`, call.arguments);
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
      console.log(`[tool] ← ${call.name} ${ok ? "ok" : "error"}`, output);
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

      // end_call means the agent wrapped up — finalize (email the briefing
      // from the transcript), let the agent say goodbye, then tear down.
      if (call.name === "end_call" && ok) {
        finalizeRef.current?.("completed");
        setTimeout(() => endCallRef.current?.(), 8000);
      }
    },
    [send, toolCall],
  );

  // Handle one server event from the data channel.
  const handleServerEvent = useCallback(
    (event: { type: string } & Record<string, unknown>) => {
      // Ignore any late events once the call is being/has been torn down, so a
      // straggling audio event can't re-trigger the orb after End.
      if (!pcRef.current) return;
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
        case ServerEvent.ConversationItemAdded: {
          // An item entered the conversation IN ORDER. Create its (initially
          // empty) bubble now so the transcript stays chronological even though
          // the user's transcription text arrives later than the agent's reply.
          const item = (event as { item?: { id?: string; role?: string } }).item;
          const itemId = item?.id;
          const role = item?.role; // "user" | "assistant"
          if (itemId && (role === "user" || role === "assistant")) {
            setTranscript((prev) =>
              ensureBubble(prev, itemId, role === "user" ? "user" : "agent"),
            );
          }
          break;
        }
        case ServerEvent.OutputTranscriptDelta: {
          const delta = (event as { delta?: string }).delta ?? "";
          // Fill the agent bubble for this response item (created above, or
          // created here if the added event didn't arrive first).
          const itemId = (event as { item_id?: string }).item_id ?? "agent";
          setTranscript((prev) => appendDeltaById(prev, itemId, "agent", delta));
          break;
        }
        case ServerEvent.InputTranscriptCompleted: {
          const text = (event as { transcript?: string }).transcript ?? "";
          const itemId = (event as { item_id?: string }).item_id;
          // Drop noise-hallucination transcripts (foreign script, 1-char blips).
          if (!isLikelyRealSpeech(text)) {
            // If a placeholder bubble was created for this item, remove it.
            if (itemId) setTranscript((prev) => removeBubble(prev, itemId));
            break;
          }
          // Fill the user's in-order bubble (created on conversation.item.added)
          // with the transcribed text. Falls back to appending if not found.
          setTranscript((prev) => setBubbleText(prev, itemId, "user", text.trim()));
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

  const connect = useCallback(async (contact?: { email?: string; phone?: string }) => {
    if (status === "connecting" || status === "connected") return;
    setError(null);
    setStatus("connecting");
    // Fresh call: clear last transcript and re-arm the finalize guard.
    setTranscript([]);
    transcriptRef.current = [];
    finalizedRef.current = false;
    // Remember the lead's contact so the briefing email can include it.
    contactRef.current = contact ?? {};
    try {
      // 1. Mint an ephemeral token from our backend (with the lead's contact).
      const { clientSecret } = await session.mutateAsync(contact);
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
                  // Must match the server session config (route.ts). server_vad
                  // with a high threshold rejects background room noise; English
                  // transcription avoids foreign-language hallucinations.
                  turn_detection: {
                    type: "server_vad",
                    threshold: 0.85,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 900,
                    create_response: true,
                    interrupt_response: false,
                  },
                  transcription: { model: "gpt-4o-transcribe", language: "en" },
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
          // Unexpected drop — file an "abandoned" briefing if not already done.
          finalizeRef.current?.("abandoned");
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

  // Post a call's transcript to the backend, which analyzes it and emails the
  // briefing. Runs at most once per call (finalizedRef). Uses sendBeacon for
  // the abandoned case so it survives tab close / refresh.
  const finalize = useCallback((reason: "completed" | "abandoned") => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    const payload = JSON.stringify({
      reason,
      contact: contactRef.current,
      transcript: transcriptRef.current.map((t) => ({
        role: t.role,
        text: t.text,
      })),
    });
    try {
      if (reason === "abandoned" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(
          "/api/realtime/finalize",
          new Blob([payload], { type: "application/json" }),
        );
      } else {
        void fetch("/api/realtime/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      }
    } catch {
      /* best-effort: never block teardown on the email */
    }
  }, []);
  finalizeRef.current = finalize;

  const disconnect = useCallback(() => {
    // Manual hang-up still files a briefing (treated as an early/abandoned end;
    // the analysis flags it "unfinished" if too little was captured).
    finalize("abandoned");
    cleanup();
    setStatus("idle");
    setVoiceState("idle");
  }, [cleanup, finalize]);

  // Keep the ref pointing at the latest disconnect for end_call teardown.
  endCallRef.current = disconnect;

  // Mirror transcript into a ref for unload-time access (sendBeacon).
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Safety net: if the page is hidden/closed mid-call, beacon an abandoned
  // briefing before we lose the transcript.
  useEffect(() => {
    const onLeave = () => {
      if (status === "connected" || status === "connecting") {
        finalize("abandoned");
      }
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [finalize, status]);

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

// Create an empty bubble for an item if one doesn't exist yet, preserving the
// order items were added to the conversation. Keeps the transcript chronological
// despite the user's transcription text arriving later than the agent's reply.
function ensureBubble(
  prev: TranscriptEntry[],
  itemId: string,
  role: "user" | "agent",
): TranscriptEntry[] {
  if (prev.some((e) => e.itemId === itemId)) return prev;
  return [...prev, { id: cryptoId(), role, text: "", itemId }];
}

// Append a streaming delta to the bubble for itemId (found anywhere, so a late
// user message can't fracture an in-progress agent turn). Creates it if absent.
function appendDeltaById(
  prev: TranscriptEntry[],
  itemId: string,
  role: "user" | "agent",
  delta: string,
): TranscriptEntry[] {
  const idx = prev.findIndex((e) => e.itemId === itemId);
  if (idx !== -1) {
    const next = prev.slice();
    next[idx] = { ...next[idx], text: next[idx].text + delta };
    return next;
  }
  return [...prev, { id: cryptoId(), role, text: delta, itemId }];
}

// Set (replace) the text of the bubble for itemId. Creates it at the end if it
// was never added (e.g. the added event was missed).
function setBubbleText(
  prev: TranscriptEntry[],
  itemId: string | undefined,
  role: "user" | "agent",
  text: string,
): TranscriptEntry[] {
  if (itemId) {
    const idx = prev.findIndex((e) => e.itemId === itemId);
    if (idx !== -1) {
      const next = prev.slice();
      next[idx] = { ...next[idx], text };
      return next;
    }
  }
  return [...prev, { id: cryptoId(), role, text, itemId }];
}

// Remove a bubble by itemId (e.g. a placeholder whose transcript was noise).
function removeBubble(
  prev: TranscriptEntry[],
  itemId: string,
): TranscriptEntry[] {
  return prev.filter((e) => e.itemId !== itemId);
}

function cryptoId(): string {
  return crypto.randomUUID();
}

// Heuristic to reject noise-hallucination transcripts (a stray "Yes", a garbled
// non-word, or foreign-script junk picked up from a crowded room) before
// showing them. Real English user turns clear this easily.
function isLikelyRealSpeech(raw: string): boolean {
  const text = raw.trim();
  if (!text) return false;
  // Must contain at least one ASCII letter — filters pure punctuation/symbols.
  if (!/[a-zA-Z]/.test(text)) return false;
  // Reject foreign-script hallucinations: any code point above the Latin
  // range (0x250) is CJK / Hangul / Cyrillic / Arabic / etc. We lock the
  // transcriber to English, so these only appear as noise. Accented Latin
  // (under 0x250) stays allowed.
  for (let i = 0; i < text.length; i++) {
    if (text.codePointAt(i)! > 0x250) return false;
  }
  // Keep multi-word turns. For a single "word", require ≥2 letters — drops
  // 1-char blips, not legitimate short replies ("Yes", "No", "Okay").
  const words = text.split(/\s+/);
  if (words.length === 1 && text.replace(/[^a-zA-Z]/g, "").length < 2) {
    return false;
  }
  return true;
}
