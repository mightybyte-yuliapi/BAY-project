// src/app/api/realtime/finalize/route.ts
//
// The single post-call endpoint. The client posts the raw transcript here when
// a call ends — whether the agent wrapped it up ("completed") or the prospect
// closed/refreshed the tab or dropped ("abandoned"). We analyze the transcript
// (summary + recommendations + flag) and email the briefing to the team.
//
// Reliability: the client uses navigator.sendBeacon for the abandoned case, so
// this must accept a plain POST body and not depend on response handling.

import { analyzeTranscript } from "@/lib/report/analyze";
import {
  callHtml,
  callSubject,
  callText,
  type EndReason,
  type LeadContact,
  type TranscriptLine,
} from "@/lib/report/callReport";
import { sendEmail, REPORT_RECIPIENTS } from "@/lib/email/send";

type FinalizeBody = {
  transcript?: TranscriptLine[];
  reason?: EndReason;
  contact?: LeadContact;
};

export async function POST(request: Request) {
  let body: FinalizeBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const transcript = Array.isArray(body.transcript) ? body.transcript : [];
  const reason: EndReason = body.reason === "abandoned" ? "abandoned" : "completed";
  const contact: LeadContact = {
    email: body.contact?.email?.trim() || undefined,
    phone: body.contact?.phone?.trim() || undefined,
  };

  const analysis = await analyzeTranscript(transcript, reason);

  const result = await sendEmail({
    to: REPORT_RECIPIENTS,
    subject: callSubject(analysis),
    html: callHtml(analysis, transcript, contact),
    text: callText(analysis, transcript, contact),
  });

  return Response.json(
    { flag: analysis.flag, reason, ...result },
    { status: result.ok ? 200 : 502 },
  );
}
