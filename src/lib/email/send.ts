// src/lib/email/send.ts
//
// ─────────────────────────────────────────────────────────────────────────
// STUB — owned by the PM / email-service dev.
// This is the single seam where email leaves the building. Right now it just
// logs the rendered email and pretends to succeed. Swap the body of sendEmail
// with a real provider (Resend, SendGrid, SES, Nodemailer, etc). The shape of
// EmailMessage and the return type should stay the same so callers don't change.
// ─────────────────────────────────────────────────────────────────────────

export type EmailMessage = {
  to: string;
  subject: string;
  /** Rendered HTML body. */
  html: string;
  /** Plain-text fallback body. */
  text: string;
};

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

// Where qualification reports go. Override via env if you like.
export const AARON_EMAIL = process.env.AARON_EMAIL ?? "aaron@appmakers.com";

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  // TODO(email-service): replace with a real provider call.
  console.log("─".repeat(60));
  console.log("[email:STUB] would send email");
  console.log("  to:     ", msg.to);
  console.log("  subject:", msg.subject);
  console.log("  text:\n" + msg.text);
  console.log("─".repeat(60));

  return { ok: true, id: "stub-" + Date.now() };
}
