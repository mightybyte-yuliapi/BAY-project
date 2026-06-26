# Email Integration (SendGrid)

How the end-of-call qualification report gets emailed. This documents the real
service wiring so anyone on the team can configure, test, deploy, or swap it.

## Overview

```
agent calls end_call tool
   └─ src/agent/tools/endCall.ts
        builds a LeadReport, renders it, calls sendEmail()
        └─ src/lib/report/render.ts   → subject + HTML + text
        └─ src/lib/email/send.ts      → POST https://api.sendgrid.com/v3/mail/send
```

- **Provider:** SendGrid v3 Mail Send API, called over plain `fetch` (no SDK
  dependency — matches the project's lean approach).
- **The single seam is `sendEmail()`** in `src/lib/email/send.ts`. Callers never
  know the provider; to swap to Resend/SES/Nodemailer, change only that function
  body — keep the `EmailMessage` shape and `SendResult` return.

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `SENDGRID_API_KEY` | yes (to send) | SendGrid API key. **Must be exactly 69 chars** and have the **Mail Send** scope. |
| `SENDGRID_FROM_EMAIL` | yes (to send) | The "from" address. **Must be a SendGrid-verified sender** (single sender or authenticated domain). |
| `SENDGRID_FROM_NAME` | no | Display name for the sender. Defaults to `AppMakers USA`. |
| `REPORT_RECIPIENTS` | no | Comma/space/semicolon-separated list of report recipients. Defaults to `aaron@mightybyte.us, bradley@mightybyte.us`. |

See `.env.example` for the template.

**Stub fallback:** if `SENDGRID_API_KEY` or `SENDGRID_FROM_EMAIL` is unset,
`sendEmail()` logs the rendered email to the console and returns `{ ok: true }`
so local dev works without credentials. The signature never changes.

### Local dev
1. `cp .env.example .env.local`
2. Fill in `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `REPORT_RECIPIENTS`.
3. **Restart `npm run dev`** — Next.js reads env only at server start.

### Production (Vercel)
Add the same vars in **Project → Settings → Environment Variables**
(Production + Preview), then **redeploy** — existing deployments don't pick up
new env vars.

## Recipients

Set `REPORT_RECIPIENTS` to a list, e.g.:

```
REPORT_RECIPIENTS=aaron@mightybyte.us, bradley@mightybyte.us
```

Parsed by `parseRecipients()` (splits on commas/semicolons/whitespace, trims,
drops blanks). All listed addresses receive the same email (one SendGrid
`personalization` with multiple `to` entries).

## Testing delivery

A dev-only smoke-test endpoint exercises the **real** send path (sample report →
renderer → `sendEmail` → SendGrid) without a voice call:

```bash
# send the sample report to REPORT_RECIPIENTS
curl http://localhost:3001/api/email/test

# send to a specific address
curl "http://localhost:3001/api/email/test?to=you@example.com"
```

- Success → `{"ok":true,"id":"<sendgrid-message-id>"}` (HTTP 200) and the email
  arrives. A real `id` (not `stub-...`) means it actually went through SendGrid.
- Failure → `{"ok":false,"error":"..."}` (HTTP 502) and the server logs an
  `[email] ❌` line with the SendGrid response.

Source: `src/app/api/email/test/route.ts`. **Safe to delete** once delivery is
trusted — it's purely a dev convenience.

### Validate a key without sending
```bash
curl -H "Authorization: Bearer $SENDGRID_API_KEY" https://api.sendgrid.com/v3/scopes
# 200 + a scopes list (must include "mail.send") → key is good
# 401 → key invalid/expired/revoked or truncated
```

## Logs

`sendEmail()` logs every attempt (`src/lib/email/send.ts`):

```
[email] sending via SendGrid → { to, from, subject, apiKey: 'SG.xxx…yyy (len 69)' }
[email] ✅ SendGrid accepted (202). x-message-id: <id>
[email] ❌ SendGrid rejected (<status>): <body>
```

The `apiKey` fingerprint shows the length — a quick way to catch truncated keys.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `401 invalid/expired/revoked` | Key wrong, truncated, or revoked. **A valid key is 69 chars** — `len 68` in logs = truncated paste. | Recreate the key (Full Access / Mail Send), copy the whole thing with the copy button, restart dev. |
| `403 Forbidden` | Sender not verified. | Verify `SENDGRID_FROM_EMAIL` in SendGrid → Settings → Sender Authentication. A `+subaddress` (e.g. `yulia+bay@...`) must be verified specifically. |
| No logs at all in your terminal | The dev server is running elsewhere (e.g. a background process), or you're in the wrong directory. | Run `npm run dev` from `/Users/yuliapi/BAY-project` in your own terminal. |
| Email shows "images not displayed" in Gmail | Normal first-sender behavior; report has no real images. | Ignore, or click "Always display images from …". |
| End-of-call sends nothing | The **"End conversation" button** just hangs up — it does NOT call `end_call`. | Let the **agent** end the call (wrap up verbally) so it fires `end_call`. (Optional: wire the button to call `end_call` first.) |

## Swapping providers

`sendEmail(msg: EmailMessage): Promise<SendResult>` is the only contract.
Replace the SendGrid `fetch` block with the new provider's call; keep:
- input `EmailMessage` = `{ to: string | string[]; subject; html; text }`
- output `SendResult` = `{ ok: true; id } | { ok: false; error }`

Nothing upstream (`end_call`, the test endpoint) changes.
