# AppMakers First-Touch Voice Agent — Architecture Overview

## The goal

A voice agent that acts as AppMakers' **first-touch qualification rep**. An
inbound lead talks to it by voice; the agent qualifies them per the PM's system
prompt, optionally gives a grounded ballpark estimate, and at the end of the call
**emails Aaron (COO) a structured qualification report**. Producing that report
is the mandatory deliverable — a call without it is a failed call.

- **Speech-to-speech:** OpenAI Realtime API (`gpt-realtime-2`) over **WebRTC**.
- **Security:** the OpenAI key never leaves the server. The backend mints a
  short-lived **ephemeral client secret**; the browser connects to OpenAI
  directly with that. Audio streams browser↔OpenAI (low latency); only the token
  and tool execution go through our backend.
- **Behavior:** driven entirely by `src/agent/config.ts` (the PM's prompt) +
  `src/agent/knowledge.ts` (firm facts + tone examples).

```
Browser (mic + UI)
   │  ① POST /api/realtime/session  → backend mints ephemeral token (key stays server-side)
   │  ② WebRTC audio  ⇄  OpenAI directly
   │  ③ data channel events (speech state, transcripts, function calls)
   │  ④ function call → POST /api/realtime/tools → backend runs the tool handler
   ▼
OpenAI Realtime (gpt-realtime-2)
```

## Tool calling (how work is split off)

The model can only talk and call tools. Every real-world action is a tool. Tools
live in `src/agent/tools/`, are registered in `tools/index.ts`, and **execute on
the backend** (`/api/realtime/tools`). Adding one = one file + one registry line.

| Tool | Purpose | Status |
|---|---|---|
| `end_call` | Files the structured qualification report and emails Aaron. Mandatory end-of-call action. | ✅ Built (email send is stubbed) |
| `lookup_comparable_projects` | Grounds a ballpark estimate in real past projects, by feature. Only used when a lead asks cost. Returns `shouldDefer` when there's no real comparable (agent must not invent a number). | ✅ Built (data source is stubbed) |

## What's DONE (Dev A — me)

- **App skeleton:** Next.js 16 (PPR via `cacheComponents`), TS, Tailwind v4,
  shadcn/ui, React Query.
- **WebRTC realtime client** — `src/lib/realtime/useRealtimeAgent.ts`: token
  mint, peer connection, mic capture + **device picker** (avoids silent virtual
  mics like ZoomAudioDevice), data-channel event stream, semantic-VAD turn
  detection, transcripts, function-call relay, auto-teardown on `end_call`.
- **Backend routes** — `src/app/api/realtime/session/route.ts` (token mint +
  session config) and `.../tools/route.ts` (tool dispatch).
- **Tool framework** — `src/agent/tools/_define.ts` + `index.ts` (schema +
  backend handler per tool).
- **Both tools** — `end_call`, `lookup_comparable_projects` (verified end-to-end).
- **Report pipeline** — `src/lib/report/types.ts` (schema) +
  `render.ts` (structured report → scannable HTML + text email Aaron reads).
  **No PDF** — the report is a fast inbox read; render a PDF from the same
  `LeadReport` later only if asked.
- **Agent prompt** — `src/agent/config.ts` holds the PM's full system prompt;
  `knowledge.ts` holds the (real) AppMakers facts.
- **UI** — modular feature components in `src/components/agent/`
  (`Agent`, `VoiceOrb` animation, `MicButton`, `MicSelect`, `ConnectionStatus`,
  `TranscriptView`, `ToolActivity`).
- **State** — React Query owns server state (token mint, tool calls); the
  realtime hook owns live voice state (listening/speaking/connection).

## What's STUBBED (Dev B — pick up here)

Each stub is a clean seam: a typed function/constant the agent and tools already
call. Swap the internals, keep the signature, and nothing upstream changes.

### 1. Email sending — `src/lib/email/send.ts`
- **Now:** `sendEmail()` logs the rendered email and returns `{ ok: true }`.
- **Do:** wire a real provider (Resend / SendGrid / SES / Nodemailer). Keep the
  `EmailMessage` shape and `SendResult` return. Set `AARON_EMAIL` (env
  `AARON_EMAIL`). The report HTML/text is already rendered for you — just send it.
- **Coordinates with:** the PM's email service.

### 2. Comparable-projects data — `src/lib/estimates/comparables.ts`
- **Now:** `findComparables()` matches against a small hardcoded `FIXTURE`.
- **Do:** replace the data source with the PM's scraped **estimate `.md`** of
  real shipped projects. Keep `Comparable` shape + the `findComparables` /
  `ComparablesResult` signature. Preserve `shouldDefer` (true when no real match
  → agent defers to R&D instead of inventing a number).
- **Coordinates with:** the PM's estimate info + scraped data.

### 3. Tone / transcript examples — `src/agent/knowledge.ts` → `TONE_EXAMPLES`
- **Now:** a placeholder with a few illustrative snippets.
- **Do:** replace with **real call transcript excerpts** from Dan so the agent
  matches actual tone and pacing. Keep it concise (2–4 short labeled excerpts —
  this text ships on every session and costs tokens). It's just a string composed
  into the prompt; only this constant changes.
- **Coordinates with:** the PM/Dan's transcripts.

### 4. (Optional) firm-facts source — `src/agent/knowledge.ts` → `APPMAKERS_FACTS`
- Currently static and complete. Only revisit if the PM wants facts pulled from
  scraped markdown at runtime instead of baked into the prompt.

## Boundary summary

- **Dev A owns:** what the agent collects, the tool framework, report shape +
  rendering, the realtime/WebRTC client, UI.
- **Dev B owns:** how email leaves the building (`email/send.ts`), the estimate
  data source (`estimates/comparables.ts`), and the transcript/tone content
  (`knowledge.ts → TONE_EXAMPLES`).

The two sides only meet at three typed seams above — you can both work without
touching each other's files.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

Needs `OPENAI_API_KEY` in `.env.local` (see `.env.example`). Click "Start
talking", pick a real mic, allow permission. ⚠️ Rotate any API key that was ever
shared in chat.
