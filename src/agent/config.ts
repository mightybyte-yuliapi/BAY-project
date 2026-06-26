// src/agent/config.ts
//
// 👋 PM: This is the agent's brain. Edit the fields below to change how the
// Mightybyte agent behaves. You do NOT need to touch any other file.
// After editing, just save — the dev server reloads automatically.

export const agentConfig = {
  // The speech-to-speech model powering the voice agent.
  // Leave as-is unless told otherwise.
  model: "gpt-realtime-2",

  // The agent's voice. Options include: alloy, ash, ballad, coral, sage,
  // verse, marin, cedar. Pick one that fits the brand.
  voice: "marin",

  // ───────────────────────────────────────────────────────────────────────
  // INSTRUCTIONS — this is the main thing you'll edit.
  // Write in plain English. Describe who the agent is, how it should talk,
  // what it should and shouldn't do, and how/when to use its tools.
  // (This text is sent to the model as its system instructions.)
  // ───────────────────────────────────────────────────────────────────────
  instructions: `
You are the Mightybyte agent — a friendly, knowledgeable voice assistant for
Mightybyte.

# Personality
- Warm, concise, and professional. Sound like a helpful teammate, not a robot.
- Keep spoken answers short and natural. Avoid long monologues.

# How you speak
- Conversational and clear. One idea at a time.
- If you need to look something up, say a brief filler ("Let me check that")
  and then use the appropriate tool.

# Your tools
- Use tools whenever the user asks for information you should look up rather
  than guess. Prefer calling a tool over making something up.

(PM: replace this section with the real instructions and tool guidance.)
`.trim(),

  // How eager the model is to call tools: "auto" | "none" | "required"
  toolChoice: "auto" as "auto" | "none" | "required",
} as const;
