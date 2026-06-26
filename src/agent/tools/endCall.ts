// src/agent/tools/endCall.ts
//
// The mandatory end-of-call action. The agent calls this when the conversation
// is wrapping up. It does NOT send the email itself — the client detects a
// successful end_call and posts the full transcript to /api/realtime/finalize,
// which analyzes it (summary + recommendations + flag) and emails the team.
// Keeping the structured fields gives the agent a clear "what to capture"
// checklist and a graceful close; the backend briefing is built from the
// transcript so abandoned calls are covered too.

import { tool } from "./_define";
import type { LeadReport } from "@/lib/report/types";

export default tool<LeadReport>({
  name: "end_call",
  description:
    "Call this when the conversation is ending to close out the call. The team " +
    "is emailed a briefing automatically from the conversation. This is " +
    "mandatory — every call must end with it. Fill the fields as a plain, " +
    "direct third-person summary of what you learned.",
  parameters: {
    type: "object",
    properties: {
      lead: {
        type: "object",
        description: "Who the lead is.",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          company: { type: "string" },
          source: {
            type: "string",
            description: "How they found AppMakers (referral, Clutch, form...).",
          },
        },
        required: ["name"],
      },
      contact: {
        type: "object",
        description:
          "The email/phone captured from the pre-call form (provided in the " +
          "session context). Relay them here; do not ask the lead for them.",
        properties: {
          email: { type: "string" },
          phone: { type: "string" },
        },
      },
      whatTheyWant: {
        type: "string",
        description:
          "The project in plain terms: the underlying problem, platform, and " +
          "notable scope / integration / AI signals.",
      },
      stageAndAssets: {
        type: "string",
        description:
          "Idea / prototype / live, plus any existing code, designs, or docs.",
      },
      commercial: {
        type: "string",
        description:
          "Budget awareness, funding status, timeline. State plainly if any " +
          "weren't captured.",
      },
      qualification: {
        type: "object",
        description: "Your fit judgment. The lead never hears this.",
        properties: {
          strength: { type: "string", enum: ["strong", "mixed", "weak"] },
          rationale: {
            type: "string",
            description:
              "The specific signals that drove it. Name red flags directly.",
          },
        },
        required: ["strength", "rationale"],
      },
      estimateGiven: {
        type: "string",
        description: "If you gave a range, state the range and its basis. Else omit.",
      },
      notCaptured: {
        type: "string",
        description: "Anything material you couldn't surface.",
      },
    },
    required: [
      "lead",
      "whatTheyWant",
      "stageAndAssets",
      "commercial",
      "qualification",
    ],
  },
  // No email here — the client finalizes the call (posts the transcript to
  // /api/realtime/finalize) which generates and sends the briefing.
  async handler() {
    return { ok: true, message: "Call closed. Briefing is being emailed to the team." };
  },
});
