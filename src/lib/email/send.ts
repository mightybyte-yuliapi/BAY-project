// src/lib/email/send.ts
//
// The single seam where email leaves the building. Callers (the `end_call`
// tool) build an EmailMessage and call sendEmail(); they never know the
// provider. This implementation uses SendGrid's v3 API over plain fetch (no
// SDK dependency — matches the project's lean, dependency-light approach).
//
// Required env (see .env.example):
//   SENDGRID_API_KEY     — SendGrid API key
//   SENDGRID_FROM_EMAIL  — a SendGrid-VERIFIED sender (single sender or domain)
//   SENDGRID_FROM_NAME   — display name for the sender (optional)
//   REPORT_RECIPIENTS    — comma/space-separated list of report recipients
//                          (optional; has default)
//
// If SENDGRID_API_KEY is unset, we fall back to a console-log "stub" so local
// dev works without credentials — the signature and return type never change.

export type EmailMessage = {
  /** One address or a list — all recipients receive the same email. */
  to: string | string[];
  subject: string;
  /** Rendered HTML body. */
  html: string;
  /** Plain-text fallback body. */
  text: string;
};

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

// Parse a comma/space/semicolon-separated env value into a clean address list.
function parseRecipients(raw: string | undefined, fallback: string): string[] {
  const list = (raw ?? fallback)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : [fallback];
}

// Where qualification reports go. Set REPORT_RECIPIENTS="a@x.com, b@y.com".
// (Legacy AARON_EMAIL is still honored as a fallback if set.)
export const REPORT_RECIPIENTS = parseRecipients(
  process.env.REPORT_RECIPIENTS,
  process.env.AARON_EMAIL ?? "aaron@mightybyte.us, bradley@mightybyte.us",
);

const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SENDGRID_FROM_NAME ?? "AppMakers USA";

  const recipients = (Array.isArray(msg.to) ? msg.to : [msg.to]).filter(Boolean);
  if (recipients.length === 0) {
    return { ok: false, error: "No recipients provided." };
  }

  // No key configured → stub mode so local dev still works end-to-end.
  if (!apiKey || !fromEmail) {
    console.log("─".repeat(60));
    console.log("[email:STUB] SENDGRID_API_KEY/FROM_EMAIL not set — not sending");
    console.log("  to:     ", recipients.join(", "));
    console.log("  subject:", msg.subject);
    console.log("  text:\n" + msg.text);
    console.log("─".repeat(60));
    return { ok: true, id: "stub-" + Date.now() };
  }

  console.log("[email] sending via SendGrid →", {
    to: recipients,
    from: `${fromName} <${fromEmail}>`,
    subject: msg.subject,
    apiKey: `${apiKey.slice(0, 6)}…${apiKey.slice(-4)} (len ${apiKey.length})`,
  });

  try {
    const res = await fetch(SENDGRID_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: recipients.map((email) => ({ email })) }],
        from: { email: fromEmail, name: fromName },
        subject: msg.subject,
        // Order matters to SendGrid: text/plain must come before text/html.
        content: [
          { type: "text/plain", value: msg.text },
          { type: "text/html", value: msg.html },
        ],
      }),
    });

    // SendGrid returns 202 Accepted with no body on success.
    if (res.status === 202) {
      const id = res.headers.get("x-message-id") ?? "sent";
      console.log(`[email] ✅ SendGrid accepted (202). x-message-id: ${id}`);
      return { ok: true, id };
    }

    const detail = await res.text();
    console.error(
      `[email] ❌ SendGrid rejected (${res.status} ${res.statusText}):`,
      detail || "(no body)",
    );
    return {
      ok: false,
      error: `SendGrid responded ${res.status}: ${detail || res.statusText}`,
    };
  } catch (err) {
    console.error("[email] ❌ SendGrid request threw:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "SendGrid request failed.",
    };
  }
}
