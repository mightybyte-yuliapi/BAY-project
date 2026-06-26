// src/app/api/realtime/session/route.ts
//
// Mints a short-lived ephemeral client secret for a Realtime session.
// The real OPENAI_API_KEY stays on the server and is NEVER sent to the browser.
// The frontend uses the returned client secret to open a WebRTC connection
// directly to OpenAI.

import { agentConfig } from "@/agent/config";
import { getToolSchemas } from "@/agent/tools";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  // The lead's contact info (captured before the call). At least one of these
  // is required by the UI before connecting; we make it available to the agent
  // so it knows how to reach the lead and can include it in the report.
  const body = await request.json().catch(() => ({}));
  const contact = (body?.contact ?? {}) as { email?: string; phone?: string };
  const contactLines = [
    contact.email && `Email: ${contact.email}`,
    contact.phone && `Phone: ${contact.phone}`,
  ].filter(Boolean);
  const contactBlock = contactLines.length
    ? `\n\n# LEAD CONTACT (provided before the call)\nThe lead gave us this contact info, so you do not need to ask for it. Use it in the report.\n${contactLines.join("\n")}`
    : "";

  // Configure the session the client will connect to. Instructions, voice,
  // model, and the tool *schemas* (no handlers) come from the agent layer.
  const sessionConfig = {
    session: {
      type: "realtime",
      model: agentConfig.model,
      // Highest reasoning effort: best instruction-following and the most
      // natural, on-script conversation. Costs a little latency.
      reasoning: { effort: "xhigh" },
      instructions: agentConfig.instructions + contactBlock,
      audio: {
        input: {
          // server_vad with a raised threshold is more robust in NOISY rooms
          // than semantic_vad: it only triggers on audio above a loudness bar,
          // so distant background voices / crosstalk don't get treated as the
          // user speaking. threshold 0.5 → 0.8 makes it require louder, closer
          // speech; silence_duration gives a natural end-of-turn pause.
          turn_detection: {
            type: "server_vad",
            // Crowded-room tuning. High threshold so only loud, close speech
            // registers. interrupt_response:false means room noise can NEVER
            // chop the agent off mid-sentence or make it restart its own turn —
            // it always finishes cleanly, then listens. (Trade-off: you wait
            // for it to finish instead of talking over it. Best for reliability
            // in noise.) Lower threshold toward 0.7 in a quiet room.
            threshold: 0.95,
            prefix_padding_ms: 300,
            silence_duration_ms: 1000,
            create_response: true,
            interrupt_response: false,
          },
          // Lock transcription to English so background murmur is never
          // mis-detected as another language (the "아직도?" hallucinations).
          transcription: { model: "gpt-4o-transcribe", language: "en" },
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
