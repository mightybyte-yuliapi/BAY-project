// src/lib/report/analyze.ts
//
// Runs the analysis prompt (prompts.ts) over a raw transcript and returns the
// structured { flag, title, summary, recommendations }. Uses the OpenAI Chat
// Completions API over plain fetch (reuses OPENAI_API_KEY — no new secret).
//
// Swap providers by changing only the fetch block; keep analyzeTranscript's
// signature and the CallAnalysis return.

import { agentConfig } from "@/agent/config";
import { buildAnalysisSystemPrompt, ANALYSIS_USER_TEMPLATE } from "./prompts";
import type {
  CallAnalysis,
  CallFlag,
  EndReason,
  TranscriptLine,
} from "./callReport";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
// Text model for the post-call write-up. Override with OPENAI_ANALYSIS_MODEL.
const ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4o-mini";

const VALID_FLAGS: CallFlag[] = [
  "strong",
  "mixed",
  "weak",
  "suspicious",
  "unfinished",
  "too_thin",
];

function renderTranscript(t: TranscriptLine[]): string {
  if (!t.length) return "(empty — no speech was captured)";
  return t.map((l) => `${l.role === "user" ? "Lead" : "Agent"}: ${l.text}`).join("\n");
}

// Heuristic floor: an essentially empty call is "unfinished" regardless of model.
function tooThinToJudge(t: TranscriptLine[]): boolean {
  const leadTurns = t.filter((l) => l.role === "user" && l.text.trim().length > 1);
  return leadTurns.length === 0;
}

export async function analyzeTranscript(
  transcript: TranscriptLine[],
  reason: EndReason,
): Promise<CallAnalysis> {
  // Short-circuit empty/near-empty calls — no point spending a token.
  if (tooThinToJudge(transcript)) {
    return {
      flag: "too_thin",
      title: "Too thin to judge",
      summary:
        reason === "abandoned"
          ? "The prospect left before saying anything substantive (page closed, refreshed, or connection dropped)."
          : "The call ended with nothing substantive captured.",
      recommendations:
        "No action needed unless this repeats. If the same caller keeps dropping, watch for a connection issue in the demo.",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Dev fallback so the flow works without a key.
    return {
      flag: "unfinished",
      title: "Analysis unavailable",
      summary: "OPENAI_API_KEY not set — transcript captured but not analyzed.",
      recommendations: "Set OPENAI_API_KEY to enable AI summary + recommendations.",
    };
  }

  const userMsg = ANALYSIS_USER_TEMPLATE.replace("{{REASON}}", reason).replace(
    "{{TRANSCRIPT}}",
    renderTranscript(transcript),
  );

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          // The analyst's rules ARE the agent's own system prompt (config.ts),
          // so qualification criteria/tone/people stay in one place.
          {
            role: "system",
            content: buildAnalysisSystemPrompt(agentConfig.instructions),
          },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[analyze] ❌ OpenAI ${res.status}:`, detail.slice(0, 300));
      return fallback(reason, "The AI analysis call failed; see raw transcript below.");
    }

    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Partial<CallAnalysis>;

    const flag = VALID_FLAGS.includes(parsed.flag as CallFlag)
      ? (parsed.flag as CallFlag)
      : "weak";

    return {
      flag,
      title: parsed.title?.trim() || "AppMakers call",
      summary: parsed.summary?.trim() || "No summary produced.",
      recommendations: parsed.recommendations?.trim() || "No recommendations produced.",
    };
  } catch (err) {
    console.error("[analyze] ❌ threw:", err);
    return fallback(reason, "The AI analysis errored; see raw transcript below.");
  }
}

function fallback(reason: EndReason, note: string): CallAnalysis {
  return {
    flag: reason === "abandoned" ? "unfinished" : "weak",
    title: "AppMakers call (analysis failed)",
    summary: note,
    recommendations: "Review the raw transcript manually.",
  };
}
