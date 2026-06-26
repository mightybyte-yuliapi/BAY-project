// src/lib/report/types.ts
//
// The structured qualification report. Fields map 1:1 to the PM brief's
// "END OF CALL — THE REPORT" section. The agent fills these via the end_call
// tool; the renderer turns them into the email Aaron reads.

export type QualificationStrength = "strong" | "mixed" | "weak";

export type LeadReport = {
  // Lead: Name, role, company, how they found us.
  lead: {
    name: string;
    role?: string;
    company?: string;
    source?: string; // referral, Clutch, inbound form, etc.
  };
  // Contact: email + phone captured from the pre-call form (attached to the
  // session). The agent doesn't ask for these; it just relays what it was given.
  contact?: {
    email?: string;
    phone?: string;
  };
  // What they want: project in plain terms, underlying problem, platform,
  // notable scope/integration/AI signals.
  whatTheyWant: string;
  // Stage & assets: idea / prototype / live, plus existing code/designs/docs.
  stageAndAssets: string;
  // Commercial: budget awareness, funding status, timeline. State plainly if
  // any weren't captured.
  commercial: string;
  // Qualification assessment: judgment + the specific signals that drove it.
  qualification: {
    strength: QualificationStrength;
    rationale: string; // signals, red flags, whale signals
  };
  // Estimate given: range + basis, or note that none was requested.
  estimateGiven?: string;
  // Not captured: anything material left unsurfaced.
  notCaptured?: string;
};
