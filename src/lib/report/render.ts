// src/lib/report/render.ts
//
// Turns a structured LeadReport into the email Aaron reads. Plain, scannable,
// CRM-note style — no filler. Produces both HTML and plain-text bodies plus a
// subject line. (No PDF: the report is a fast inbox read, per the brief. If a
// PDF is ever wanted, render it from the same LeadReport here.)

import type { LeadReport } from "./types";

const STRENGTH_LABEL: Record<LeadReport["qualification"]["strength"], string> = {
  strong: "STRONG",
  mixed: "MIXED",
  weak: "WEAK",
};

export function reportSubject(r: LeadReport): string {
  const who = [r.lead.name, r.lead.company].filter(Boolean).join(" — ");
  return `Lead: ${who || "Unknown"} [${STRENGTH_LABEL[r.qualification.strength]}]`;
}

export function reportText(r: LeadReport): string {
  const leadLine = [
    r.lead.name,
    r.lead.role,
    r.lead.company,
    r.lead.source && `via ${r.lead.source}`,
  ]
    .filter(Boolean)
    .join(", ");

  const contactLine =
    [r.contact?.email, r.contact?.phone].filter(Boolean).join(" · ") ||
    "Not provided";

  return [
    `LEAD: ${leadLine || "Not captured"}`,
    ``,
    `CONTACT: ${contactLine}`,
    ``,
    `WHAT THEY WANT:`,
    r.whatTheyWant,
    ``,
    `STAGE & ASSETS:`,
    r.stageAndAssets,
    ``,
    `COMMERCIAL:`,
    r.commercial,
    ``,
    `QUALIFICATION: ${STRENGTH_LABEL[r.qualification.strength]}`,
    r.qualification.rationale,
    ``,
    `ESTIMATE GIVEN:`,
    r.estimateGiven?.trim() || "None requested.",
    ``,
    `NOT CAPTURED:`,
    r.notCaptured?.trim() || "—",
  ].join("\n");
}

export function reportHtml(r: LeadReport): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");

  const leadLine = [
    r.lead.name,
    r.lead.role,
    r.lead.company,
    r.lead.source && `via ${r.lead.source}`,
  ]
    .filter(Boolean)
    .join(", ");

  const section = (title: string, body: string) =>
    `<h3 style="margin:18px 0 4px;font:600 13px/1.4 -apple-system,Segoe UI,sans-serif;color:#111;text-transform:uppercase;letter-spacing:.04em">${title}</h3>
     <div style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;color:#222">${body}</div>`;

  const contactLine =
    [r.contact?.email, r.contact?.phone].filter(Boolean).join(" · ") ||
    "Not provided";

  return `<div style="max-width:620px">
    ${section("Lead", esc(leadLine || "Not captured"))}
    ${section("Contact", esc(contactLine))}
    ${section("What they want", esc(r.whatTheyWant))}
    ${section("Stage & assets", esc(r.stageAndAssets))}
    ${section("Commercial", esc(r.commercial))}
    ${section(
      `Qualification — ${STRENGTH_LABEL[r.qualification.strength]}`,
      esc(r.qualification.rationale),
    )}
    ${section("Estimate given", esc(r.estimateGiven?.trim() || "None requested."))}
    ${section("Not captured", esc(r.notCaptured?.trim() || "—"))}
  </div>`;
}
