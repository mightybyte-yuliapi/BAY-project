// src/app/api/email/test/route.ts
//
// Email-delivery smoke test. Hit this to verify the REAL email path end-to-end
// (sample report → renderer → sendEmail → SendGrid) without doing a voice call.
//
//   GET  /api/email/test            → send the sample report to REPORT_RECIPIENTS
//   GET  /api/email/test?to=x@y.com → send to a specific address instead
//
// Returns the SendResult as JSON so you can see success/failure in the browser.
// Safe to delete once email is verified — it's purely a dev convenience.

import { sendEmail, REPORT_RECIPIENTS } from "@/lib/email/send";
import { reportHtml, reportSubject, reportText } from "@/lib/report/render";
import type { LeadReport } from "@/lib/report/types";

const SAMPLE: LeadReport = {
  lead: {
    name: "Test Lead",
    role: "Founder",
    company: "Acme Co",
    source: "email-delivery smoke test",
  },
  whatTheyWant:
    "A cross-platform scheduling app (iOS + Android) with calendar sync and " +
    "push notifications. Core problem: manual booking over text today.",
  stageAndAssets: "Idea stage. Has Figma wireframes; no code yet.",
  commercial: "Budget ~$40k, seed-funded, wants to launch in ~8 weeks.",
  qualification: {
    strength: "strong",
    rationale:
      "Clear scope, real budget, decision-maker on the call, urgent timeline. " +
      "No red flags surfaced.",
  },
  estimateGiven: "Rough $30k–$45k, based on comparable MVPs. Not a quote.",
  notCaptured: "Exact third-party integrations still TBD.",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const toParam = url.searchParams.get("to");
  const to = toParam ? [toParam] : REPORT_RECIPIENTS;

  const result = await sendEmail({
    to,
    subject: reportSubject(SAMPLE),
    html: reportHtml(SAMPLE),
    text: reportText(SAMPLE),
  });

  return Response.json(
    { sentTo: to, ...result },
    { status: result.ok ? 200 : 502 },
  );
}
