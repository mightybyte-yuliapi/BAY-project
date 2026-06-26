// src/app/api/realtime/session/route.ts
//
// Mints a short-lived ephemeral client secret for a Realtime session.
// The real OPENAI_API_KEY stays on the server and is NEVER sent to the browser.
// The frontend uses the returned client secret to open a WebRTC connection
// directly to OpenAI.

import { agentConfig } from "@/agent/config";
import { getToolSchemas } from "@/agent/tools";

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  // Configure the session the client will connect to. Instructions, voice,
  // model, and the tool *schemas* (no handlers) come from the agent layer.
  const sessionConfig = {
    session: {
      type: "realtime",
      model: agentConfig.model,
      instructions: agentConfig.instructions,
      audio: {
        input: {
          // Auto-detect when the user starts/stops speaking. Required for
          // input_audio_buffer.speech_started/stopped events (drives the
          // "listening" animation) and for hands-free conversation.
          turn_detection: { type: "semantic_vad" },
          // Transcribe the user's speech so we can show it in the transcript.
          transcription: { model: "whisper-1" },
        },
        output: { voice: agentConfig.voice },
      },
      tools: getToolSchemas(),
      tool_choice: agentConfig.toolChoice,
    },
  };

  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Bind the issued secret to this session for safety/identification.
      "OpenAI-Safety-Identifier": "mightybyte-agent",
    },
    body: JSON.stringify(sessionConfig),
  });

  if (!res.ok) {
    const detail = await res.text();
    return Response.json(
      { error: "Failed to mint Realtime client secret.", detail },
      { status: res.status },
    );
  }

  const data = await res.json();
  // Return only what the browser needs: the ephemeral secret and the model.
  return Response.json({ clientSecret: data, model: agentConfig.model });
}
