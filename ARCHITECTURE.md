# AppMakers First-Touch Voice Agent — Architecture Overview

## The goal

A voice agent that acts as AppMakers' **first-touch qualification rep**. An
inbound lead talks to it by voice; the agent qualifies them per the PM's system
prompt, optionally gives a grounded ballpark estimate, and at the end **the team
is emailed a qualification briefing**. The briefing is the mandatory deliverable.

> **Update (email-agent branch):** the briefing is now generated on the **backend
> from the call transcript** (AI summary + recommendations + a triage flag), and
> it's sent on **every** call ending — the agent wrapping up, a manual hang-up, or
> the lead refreshing/closing the tab or dropping. See **Post-call briefing
> pipeline** below. `end_call` no longer emails; it's a "call complete" signal.

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
   │  ⑤ on call end → POST /api/realtime/finalize {transcript, reason, contact}
   │       (sendBeacon when abandoned, so it survives tab close/refresh)
   │       → backend analyzes transcript → emails the briefing
   ▼
OpenAI Realtime (gpt-realtime-2)
```

## Tool calling (how work is split off)

The model can only talk and call tools. Every real-world action is a tool. Tools
live in `src/agent/tools/`, are registered in `tools/index.ts`, and **execute on
the backend** (`/api/realtime/tools`). Adding one = one file + one registry line.

| Tool | Purpose | Status |
|---|---|---|
| `end_call` | Signal that the conversation is complete. The client detects it and POSTs the transcript to `/api/realtime/finalize`, which generates + emails the briefing. (No longer emails directly.) | ✅ Built |
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

## Post-call briefing pipeline (Dev B — BUILT, `email-agent` branch)

Replaces the old "end_call emails Aaron" path. Every call ending produces one
emailed briefing with a triage flag in the subject + three blocks (AI summary, AI
recommendations, raw transcript) and the lead's contact.

```
call ends → client finalize(reason)        (useRealtimeAgent.ts)
  reason "completed" = agent called end_call
  reason "abandoned" = manual hang-up, connection drop, or tab close/refresh
  POST /api/realtime/finalize {transcript, reason, contact}   (sendBeacon if abandoned)
    → analyzeTranscript()  (src/lib/report/analyze.ts)
        OpenAI chat-completion over the transcript
        SYSTEM PROMPT = the agent's OWN config.ts instructions, injected verbatim
        (buildAnalysisSystemPrompt) — one source of truth for qualification rules
    → renders email  (src/lib/report/callReport.ts)
    → sendEmail()    (src/lib/email/send.ts → SendGrid v3, REPORT_RECIPIENTS list)
```

- **Single source of truth for rules:** the post-call analyst does NOT restate
  qualification criteria — it runs on `agentConfig.instructions`. Edit `config.ts`
  and both the live call and the briefing change together.
- **Flags:** `strong` / `mixed` / `weak` (Dev A's taxonomy) + operational
  `suspicious` / `unfinished` / `too_thin`.
- **De-dup:** `finalizedRef` guarantees exactly one briefing per call.
- **Files:** `prompts.ts` (analyst wrapper), `analyze.ts`, `callReport.ts`,
  `app/api/realtime/finalize/route.ts`, `lib/email/send.ts`. Env + setup:
  `docs/EMAIL_INTEGRATION.md`.
- `src/lib/report/render.ts` + the `LeadReport` type are now legacy — used only by
  `/api/email/test` (a SendGrid delivery smoke test).

## Still STUBBED (Dev B — pick up here)

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
- **Dev B owns:** the **post-call briefing pipeline** (`report/{prompts,analyze,
  callReport}.ts`, `api/realtime/finalize`, `email/send.ts`), the estimate data
  source (`estimates/comparables.ts`), and the transcript/tone content
  (`knowledge.ts → TONE_EXAMPLES`).

> **Cross-boundary note (email-agent):** the briefing pipeline touches two of Dev
> A's files — `useRealtimeAgent.ts` (added `finalize()` + transcript posting) and
> `endCall.ts` (made signal-only). And the analyst depends on `config.ts`
> (`agentConfig.instructions`). **Pull before pushing realtime-client or
> config.ts changes.**

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

Needs `OPENAI_API_KEY` in `.env.local` (see `.env.example`). Click "Start
talking", pick a real mic, allow permission. ⚠️ Rotate any API key that was ever
shared in chat.
