// src/agent/tools/endCall.ts
//
// The mandatory end-of-call action. The agent calls this with the structured
// qualification report. The backend renders it to an email and sends it to
// Aaron (email sending is currently stubbed). This IS the deliverable — a call
// without this tool call is a failed call.

import { tool } from "./_define";
import type { LeadReport } from "@/lib/report/types";
import { reportHtml, reportSubject, reportText } from "@/lib/report/render";
import { sendEmail, REPORT_RECIPIENTS } from "@/lib/email/send";

export default tool<LeadReport>({
  name: "end_call",
  description:
    "Call this when the conversation is ending to file the qualification " +
    "report and email it to Aaron. Fill every field as a plain, direct " +
    "third-person briefing. This is mandatory — every call must end with it.",
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
              "The specific signals that drove it. Name red flags directly. " +
              "Note whale signals (size, authority, urgency, real budget).",
          },
        },
        required: ["strength", "rationale"],
      },
      estimateGiven: {
        type: "string",
        description:
          "If you gave a range, state the range and its basis. Else omit.",
      },
      notCaptured: {
        type: "string",
        description: "Anything material you couldn't surface, so Aaron knows.",
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
  async handler(report) {
    const result = await sendEmail({
      to: REPORT_RECIPIENTS,
      subject: reportSubject(report),
      html: reportHtml(report),
      text: reportText(report),
    });

    if (!result.ok) {
      return { ok: false, message: "Report could not be sent.", error: result.error };
    }
    return { ok: true, message: "Report filed and emailed to the team." };
  },
});
