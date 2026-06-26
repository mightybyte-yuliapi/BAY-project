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
  // The visible text. For agent bubbles this is revealed gradually, paced to
  // the spoken audio (see fullText) so captions track the voice.
  text: string;
  // For agent bubbles: the COMPLETE transcript received so far. `text` catches
  // up to this at speech pace while audio plays. (User bubbles ignore it.)
  fullText?: string;
  // For agent entries: the Realtime item_id this bubble belongs to, so deltas
  // for one response stay together and a new response starts a new bubble.
  itemId?: string;
};


const REALTIME_URL = "https://api.openai.com/v1/realtime/calls";

// Proactive opener — posted as the agent's first message the moment we connect,
// so the conversation kicks off instead of waiting for the client to speak.
const GREETING =
  "Hi, I'm AppMakers' virtual assistant. What are you looking to build?";

export function useRealtimeAgent() {
  const session = useRealtimeSession();
  const toolCall = useToolCall();

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  // True while a response is in flight but the agent hasn't started speaking
  // yet — drives the "Bay team thinking" indicator.
  const [thinking, setThinking] = useState(false);
  // True after the agent has wrapped up the call (end_call) — drives the
  // "conversation ended" confirmation UI.
  const [callEnded, setCallEnded] = useState(false);
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
  // True while the model has a response in flight. We must NOT send
  // response.create while one is active, or the server errors with
  // conversation_already_has_active_response (and turns get garbled).
  const activeResponseRef = useRef(false);
  // True once end_call fired and we're waiting for the agent's goodbye audio to
  // finish before tearing down — so the outro never gets clipped.
  const endingRef = useRef(false);
  // Why the call ended, set before teardown so finalize sends the right reason.
  // "completed" = agent called end_call; "abandoned" = manual hang-up / drop.
  const endReasonRef = useRef<"completed" | "abandoned">("abandoned");

  // Send a JSON event to the model over the data channel.
  const send = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (dc?.readyState === "open") dc.send(JSON.stringify(event));
  }, []);

  // Update the transcript AND keep transcriptRef in sync synchronously, so a
  // beacon firing on unload (or finalize firing the instant end_call lands)
  // always sees the latest transcript instead of a render-lagged ref. The
  // updater still reads `prev`, so it stays pure / StrictMode-safe.
  const commitTranscript = useCallback(
    (updater: (prev: TranscriptEntry[]) => TranscriptEntry[]) => {
      setTranscript((prev) => {
        const next = updater(prev);
        transcriptRef.current = next;
        return next;
      });
    },
    [],
  );

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
      // Return the result to the model, then ask it to continue speaking — but
      // only if a response isn't already in flight. With create_response:true
      // the server often auto-responds after function output; firing our own on
      // top errors with conversation_already_has_active_response and garbles the
      // turn. Guard against it.
      send({
        type: ClientEvent.CreateConversationItem,
        item: {
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(output),
        },
      });
      // Ask the model to continue speaking after a tool result — EXCEPT for
      // end_call. The agent already said its goodbye in the same turn it called
      // end_call; requesting another response just produces a redundant SECOND
      // sign-off ("Aaron will follow up..." twice). For end_call we want the
      // conversation to stop, so we never continue it.
      if (call.name !== "end_call" && !activeResponseRef.current) {
        send({ type: ClientEvent.CreateResponse });
      }

      // end_call means the agent wrapped up. Let the goodbye audio FINISH, then
      // tear down. CRITICAL: do NOT finalize (email the briefing) here — user
      // transcriptions arrive asynchronously and the last qualifying turns
      // ("$150K, I'm the COO") may not have committed yet. Snapshotting now
      // yields a thin transcript and a wrong "too thin to judge" flag. Finalize
      // happens at teardown (disconnect), by which point late transcripts have
      // landed.
      if (call.name === "end_call" && ok) {
        console.log("[agent] end_call fired → setCallEnded(true), waiting for goodbye audio");
        endingRef.current = true;
        setCallEnded(true);
        endReasonRef.current = "completed";
        setTimeout(() => {
          console.log("[agent] 15s fallback teardown");
          endCallRef.current?.();
        }, 15000);
      }
    },
    [send, toolCall],
  );

  // After the goodbye's output_audio.done, the <audio> element may still be
  // draining buffered speech. Watch the live audio level and only tear down once
  // it's been silent for a beat — so the final sentence is never clipped.
  const waitForAudioToFinishThenEnd = useCallback(() => {
    const stream =
      (audioRef.current?.srcObject as MediaStream | null) ?? null;
    const end = () => endCallRef.current?.();
    if (!stream) {
      setTimeout(end, 1500);
      return;
    }
    try {
      const ac = new AudioContext();
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let quietSince = 0;
      const startedAt = performance.now();
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        const now = performance.now();
        const speaking = peak > 4; // ~silence threshold
        if (speaking) quietSince = 0;
        else if (!quietSince) quietSince = now;
        // End after ~1.2s of continuous silence, or a 14s hard cap. (Longer
        // silence window so a natural mid-goodbye pause doesn't end early.)
        if ((quietSince && now - quietSince > 1200) || now - startedAt > 14000) {
          console.log("[agent] goodbye audio drained → teardown");
          ac.close().catch(() => {});
          end();
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setTimeout(end, 2500);
    }
  }, []);

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
          // The agent has started speaking — it's no longer just "thinking".
          setThinking(false);
          break;
        case ServerEvent.OutputAudioDone:
          setVoiceState("idle");
          // If we're ending (end_call fired): output_audio.done means the
          // SERVER finished SENDING audio, but the <audio> element may still
          // have buffered speech queued. Tearing down now clips the tail
          // ("...stopped at 'next steps'"). Wait until playback actually drains
          // before disconnecting. (The email already fired, so there's no rush.)
          if (endingRef.current) {
            waitForAudioToFinishThenEnd();
          }
          break;
        case ServerEvent.ResponseCreated:
          activeResponseRef.current = true;
          // Response started but no audio yet → the agent is "thinking".
          setThinking(true);
          break;
        case ServerEvent.ConversationItemAdded: {
          // An item entered the conversation IN ORDER. Create its (initially
          // empty) bubble now so the transcript stays chronological even though
          // the user's transcription text arrives later than the agent's reply.
          const item = (event as { item?: { id?: string; role?: string } }).item;
          const itemId = item?.id;
          const role = item?.role; // "user" | "assistant"
          if (itemId && (role === "user" || role === "assistant")) {
            commitTranscript((prev) =>
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
          // Append to fullText (the complete transcript). The reveal loop moves
          // it into the visible `text` at speech pace so captions track audio.
          // commitTranscript keeps transcriptRef synced for the finalize beacon.
          commitTranscript((prev) => appendAgentFullText(prev, itemId, delta));
          break;
        }
        case ServerEvent.InputTranscriptCompleted: {
          const text = (event as { transcript?: string }).transcript ?? "";
          const itemId = (event as { item_id?: string }).item_id;
          // Drop noise-hallucination transcripts (foreign script, 1-char blips).
          if (!isLikelyRealSpeech(text)) {
            // If a placeholder bubble was created for this item, remove it.
            if (itemId) commitTranscript((prev) => removeBubble(prev, itemId));
            break;
          }
          // Fill the user's in-order bubble (created on conversation.item.added)
          // with the transcribed text. Falls back to appending if not found.
          commitTranscript((prev) => setBubbleText(prev, itemId, "user", text.trim()));
          break;
        }
        case ServerEvent.ResponseDone: {
          activeResponseRef.current = false;
          setThinking(false);
          for (const call of extractFunctionCalls(event)) {
            void handleFunctionCall(call);
          }
          break;
        }
      }
    },
    [handleFunctionCall, commitTranscript, waitForAudioToFinishThenEnd],
  );

  const connect = useCallback(async (contact?: { email?: string; phone?: string }) => {
    if (status === "connecting" || status === "connected") return;
    setError(null);
    setStatus("connecting");
    // Fresh call: clear last transcript and re-arm the finalize guard.
    setTranscript([]);
    transcriptRef.current = [];
    finalizedRef.current = false;
    setCallEnded(false);
    setThinking(false);
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
                    threshold: 0.95,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 1000,
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
          if (evt.type === "error") {
            const code = evt.error?.code;
            // This one is benign: noise triggered the VAD while a response was
            // already active, so the server declined a duplicate. Nothing for
            // us to do — don't spam it as an error.
            if (code !== "conversation_already_has_active_response") {
              console.error("[agent] server error:", evt);
            }
          }
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
    activeResponseRef.current = false;
    endingRef.current = false;
    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  // Post a call's transcript to the backend, which analyzes it and emails the
  // briefing. Runs at most once per call (finalizedRef). Uses sendBeacon for
  // the abandoned case so it survives tab close / refresh.
  const finalize = useCallback((reason: "completed" | "abandoned") => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;

    // Build + send the payload from INSIDE a setTranscript updater, where `cur`
    // is guaranteed to be the freshest committed state — the exact array the UI
    // renders. This eliminates the drift between what's on screen and what gets
    // emailed (the mirror ref could lag pending updaters). We return `cur`
    // unchanged; this is a read, not a mutation.
    setTranscript((cur) => {
      const turns = cur
        .map((t) => ({
          role: t.role,
          // Serialize EXACTLY what the app shows: prefer the complete fullText
          // (agent turns), always fall back to visible text — never blank.
          text: ((t.fullText && t.fullText.trim()) || t.text || "").trim(),
        }))
        .filter((t) => t.text.length > 0);

      console.log(
        "[finalize] transcript snapshot:",
        turns.map((t) => `${t.role}: ${t.text.slice(0, 40)}`),
      );

      const payload = JSON.stringify({
        reason,
        contact: contactRef.current,
        transcript: turns,
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
      return cur;
    });
  }, []);
  finalizeRef.current = finalize;

  const disconnect = useCallback(() => {
    // File the briefing with the reason set by the end path ("completed" when
    // the agent called end_call, else "abandoned" for a manual hang-up/drop).
    // finalize is guarded to run once. We finalize HERE (at teardown) rather
    // than when end_call first fired, so asynchronously-arriving user
    // transcriptions have landed and the transcript is complete.
    finalize(endReasonRef.current);
    cleanup();
    setStatus("idle");
    setVoiceState("idle");
    setThinking(false);
    // Always show the ended notice once a real conversation has happened, even
    // if the model spoke a goodbye without calling end_call — the user must get
    // closure feedback regardless of how the call ended.
    if (transcriptRef.current.length > 0) setCallEnded(true);
  }, [cleanup, finalize]);

  // Keep the ref pointing at the latest disconnect for end_call teardown.
  endCallRef.current = disconnect;

  // transcriptRef is kept in sync synchronously via commitTranscript (the
  // source of truth for the beacon); no post-render mirror effect needed.

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

  // Caption reveal loop: advance each agent bubble's visible text toward its
  // fullText at a steady speech pace, so the transcript tracks the spoken audio
  // instead of racing ahead. We ALWAYS reveal gradually (never instant-dump),
  // regardless of voiceState — otherwise a second message that arrives during
  // the brief idle gap after a tool call would flush its whole text in silence
  // before its audio starts. Only the final, no-longer-active bubble is flushed
  // to completion (below), so nothing is ever left hanging.
  useEffect(() => {
    const REVEAL_CPS = 28; // chars/sec (~natural narration speed)
    const interval = setInterval(() => {
      // commitTranscript keeps transcriptRef synced so the finalize beacon sees
      // the revealed text, not a stale snapshot.
      commitTranscript((prev) => {
        // The last agent bubble is the "active" one; earlier completed bubbles
        // should already be fully shown.
        let lastAgentIdx = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].role === "agent") {
            lastAgentIdx = i;
            break;
          }
        }
        let changed = false;
        const step = Math.max(1, Math.round((REVEAL_CPS * 60) / 1000));
        const next = prev.map((e, i) => {
          if (e.role !== "agent" || e.fullText == null) return e;
          if (e.text.length >= e.fullText.length) return e;
          changed = true;
          // Flush any older agent bubble (not the active one) instantly so a
          // superseded turn never sits half-revealed.
          if (i !== lastAgentIdx) return { ...e, text: e.fullText };
          // Active bubble: reveal a chunk sized to the tick rate (60ms).
          return { ...e, text: e.fullText.slice(0, e.text.length + step) };
        });
        return changed ? next : prev;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [commitTranscript]);

  // Tear down on unmount.
  useEffect(() => cleanup, [cleanup]);

  // Post the greeting the instant we're connected (once, only if nothing has
  // arrived yet), so the agent opens proactively rather than waiting silently.
  useEffect(() => {
    if (status !== "connected") return;
    commitTranscript((prev) =>
      prev.length > 0
        ? prev
        : [{ id: cryptoId(), role: "agent", text: GREETING, fullText: GREETING }],
    );
  }, [status, commitTranscript]);

  return {
    status,
    voiceState,
    thinking,
    transcript,
    error,
    connect,
    disconnect,
    isConnected: status === "connected",
    callEnded,
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
  return [...prev, { id: cryptoId(), role, text: "", fullText: "", itemId }];
}

// Append an agent transcript delta to fullText (the complete text). The visible
// `text` is advanced toward fullText separately, paced to the audio.
function appendAgentFullText(
  prev: TranscriptEntry[],
  itemId: string,
  delta: string,
): TranscriptEntry[] {
  const idx = prev.findIndex((e) => e.itemId === itemId);
  if (idx !== -1) {
    const next = prev.slice();
    next[idx] = { ...next[idx], fullText: (next[idx].fullText ?? "") + delta };
    return next;
  }
  return [...prev, { id: cryptoId(), role: "agent", text: "", fullText: delta, itemId }];
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
      // Set BOTH text and fullText so the finalize payload (which prefers
      // fullText) never sends an empty string for user turns.
      next[idx] = { ...next[idx], text, fullText: text };
      return next;
    }
  }
  return [...prev, { id: cryptoId(), role, text, fullText: text, itemId }];
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
