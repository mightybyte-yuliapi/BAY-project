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
          // Semantic VAD with low eagerness: lets the user finish their
          // thought (including mid-sentence pauses) before the agent responds,
          // so it stops cutting in. interrupt_response lets the user barge in
          // over the agent if they start talking.
          turn_detection: {
            type: "semantic_vad",
            eagerness: "low",
            create_response: true,
            interrupt_response: true,
          },
          // gpt-4o-transcribe is more accurate than whisper-1 (fewer
          // wrong-word transcripts).
          transcription: { model: "gpt-4o-transcribe" },
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
