// src/lib/realtime/events.ts
//
// Typed names for the Realtime server/client events we care about, plus the
// UI voice states they drive. Keeps magic strings out of the hook.

// Server → client events we listen for.
export const ServerEvent = {
  // User speech (input) — drives the "listening" animation.
  SpeechStarted: "input_audio_buffer.speech_started",
  SpeechStopped: "input_audio_buffer.speech_stopped",
  // Model speech (output) — drives the "speaking" animation.
  OutputAudioDelta: "response.output_audio.delta",
  OutputAudioDone: "response.output_audio.done",
  // A response finished — may contain function_call items to execute.
  ResponseDone: "response.done",
  // Transcripts.
  OutputTranscriptDelta: "response.output_audio_transcript.delta",
  InputTranscriptCompleted:
    "conversation.item.input_audio_transcription.completed",
} as const;

// Client → server events we send.
export const ClientEvent = {
  SessionUpdate: "session.update",
  CreateConversationItem: "conversation.item.create",
  CreateResponse: "response.create",
} as const;

// The visual state of the agent, used by the animation.
export type VoiceState = "idle" | "listening" | "speaking";

// A function call surfaced by the model in a response.done event.
export type FunctionCall = {
  name: string;
  call_id: string;
  arguments: string; // JSON string
};

// Extract function_call items from a response.done payload.
export function extractFunctionCalls(responseDone: unknown): FunctionCall[] {
  const output = (responseDone as { response?: { output?: unknown[] } })
    ?.response?.output;
  if (!Array.isArray(output)) return [];
  return output.filter(
    (item): item is FunctionCall =>
      !!item &&
      typeof item === "object" &&
      (item as { type?: string }).type === "function_call",
  );
}
