# AI Lead Call Agent — Planning Doc

> **Status: Initial base plan (v0.1) — subject to change.**
> Shared starting point for the team. Open decisions are unresolved and details will evolve as we build. Propose changes via PR or discuss before reworking sections.

> Hackathon build. Voice agent that qualifies inbound leads, scores them, writes call notes, and hands off to a human.

## 1. Concept

A browser-based voice agent that:

1. **Listens** to a lead (speech-to-text).
2. **Converses** naturally, asking qualifying questions.
3. **Qualifies** — collects budget, authority, need, timeline (BANT) + contact info.
4. **Summarizes** — generates call notes, a lead score, and next steps for the CRM.
5. **Hands off** — routes to a real person when the lead is qualified or asks complex questions.

**Where the edge is:** the voice plumbing is the least differentiated part. The win is in steps 3–5 — smart qualification, a clean lead score, and a believable live human handoff. Budget time accordingly.

## 2. Architecture

```
Browser (mic)  ──WebRTC──►  OpenAI Realtime (gpt-realtime-2)
     │                              │
     │ fetches ephemeral token      │ function calls
     ▼                              ▼
Next.js route handler  ◄──────  tools: captureLeadField, scoreLead, handoffToHuman
(/api/realtime/session)
 uses OPENAI_API_KEY (server only)
```

- **WebRTC** for the browser client (mic capture + audio playback). WebSocket is for server/telephony pipelines — not needed for the browser-mic demo.
- The `OPENAI_API_KEY` **never** reaches the browser. The Next.js server mints a short-lived `ek_...` ephemeral token per session.

## 3. Tech & exact pieces

| Piece | Value |
|---|---|
| Framework | Next.js 16 (canary), React 19, Tailwind v4, shadcn — already in repo |
| Agents SDK | `npm install @openai/agents zod` |
| Model | `gpt-realtime-2` (speech-to-speech) |
| Server token endpoint | `POST https://api.openai.com/v1/realtime/client_secrets` |
| Browser classes | `RealtimeAgent`, `RealtimeSession` from `@openai/agents/realtime` |
| Transport | WebRTC (handled by the SDK) |
| Transcript | session events — drives qualification + final summary |

## 4. Flow → SDK mapping

| Step | Implementation |
|---|---|
| 1. Speech-to-text | Automatic — the Realtime model transcribes as it listens. |
| 2. Conversation agent | `RealtimeAgent` with a structured system prompt (labeled sections: role, tone, phases, exit criteria; confirm emails/numbers digit-by-digit). |
| 3. Qualification | Tools (function calls): `captureLeadField(field, value)`, `scoreLead()` — model writes into a structured BANT object instead of just chatting. |
| 4. Summary + CRM | On session end, summarize collected object + transcript → write a CRM row. |
| 5. Handoff | `handoffToHuman` tool (fires Slack/SMS) **or** an Agents-SDK handoff to a "specialist" agent. Strong live-demo beat. |

## 3b. As-built architecture (team scaffolding — reviewed 2026-06-26)

The team already shipped a **working voice loop**. Where this differs from the original §2–3 plan, **this section wins**.

**Key deviation: NO `@openai/agents` SDK.** The team hand-rolled raw WebRTC + the data-channel event stream. Fewer deps, full control. Ignore the SDK references in §3/§4 — we author against the raw event protocol instead.

**Flow as built:**
```
Browser (useRealtimeAgent) ──WebRTC──► api.openai.com/v1/realtime/calls
   │  POST /api/realtime/session  → mints ephemeral client_secret (server holds OPENAI_API_KEY)
   │  data channel "oai-events"   → transcripts, speech state, function calls
   └─ on function_call → POST /api/realtime/tools → runs handler → result fed back over data channel
```

**File map (where things live):**
| Concern | File |
|---|---|
| Persona / system prompt / voice / model | `src/agent/config.ts` (`agentConfig.instructions`, `voice: marin`, `model: gpt-realtime-2`) |
| Tool authoring | `src/agent/tools/<name>.ts` → `tool({ name, description, parameters (JSON Schema), handler })` |
| Tool registry | `src/agent/tools/index.ts` (import + add to `tools[]`) |
| Token mint route | `src/app/api/realtime/session/route.ts` (sends session config incl. tool schemas) |
| Tool exec route (backend) | `src/app/api/realtime/tools/route.ts` (`runTool` dispatch) |
| WebRTC client hook | `src/lib/realtime/useRealtimeAgent.ts` |
| Event name constants | `src/lib/realtime/events.ts` |
| UI | `src/components/agent/*` — VoiceOrb, MicButton, MicSelect, ConnectionStatus, TranscriptView, ToolActivity |
| Session/tool React Query hooks | `src/lib/queries/{useRealtimeSession,useToolCall}.ts` |

**Already working:** ephemeral-token mint, WebRTC connect, mic selection (skips virtual mics), semantic-VAD turn detection, whisper-1 input transcription, live transcript (user + agent), tool-call relay + ToolActivity panel, voice-state orb.

**Tools today:** only one example — `get_project_status` (stub). Our lead tools don't exist yet.

**⚠️ Branding mismatch to resolve:** `config.ts` + `Agent.tsx` brand the agent as **"Mightybyte"**, but our knowledge base is **AppMakersLA**. Pick one identity before wiring the prompt (see Open Decisions §8).

**Gap — lead state:** tool handlers are stateless per call. Accumulating a `Lead` object across a conversation needs either server-side session state or client-side accumulation. Decide before building `captureLeadField`.

## 4b. Company knowledge base (AppMakersLA)

The agent represents **AppMakersLA** and qualifies inbound leads for app/web/software projects. It needs to know who we are so it can answer "what do you do?", speak credibly, and qualify against real services.

**Approach (hackathon):** Pre-scrape `appmakersla.com` **once** into a curated `src/data/company-kb.md` (or `.ts`). Do **not** scrape live at call time — it adds latency and a mid-call failure point. Then either:
- (a) inject a condensed summary into the agent's system prompt (simplest, most reliable for the demo), or
- (b) expose a `lookupCompanyInfo(topic)` tool that reads the KB.

**Pages worth scraping:** Home, Services (+ subpages), Our Process, Portfolio, FAQ, About, Contact.

**Company facts (from appmakersla.com):**
- **What:** Mobile app + web + custom software dev agency for startups and enterprises.
- **Services:** iOS/Android apps, web apps, custom software, AI solutions, low-code/no-code (Bubble, Webflow), **30-Day MVP** program, staff augmentation, app design/UX, "Fix Your App" rescue + maintenance.
- **Stack:** React, React Native, Flutter, Python, Java, Swift, Node, MongoDB, MySQL, AWS, GCP.
- **Notable clients:** Walmart, US Bank, BMW, Sony, ServiceNow, Home Depot.
- **Process/pricing anchors:** Design phase ~2 weeks / ~$5,000; free consultation; project cost varies.
- **Locations:** HQ 1250 S Los Angeles St, Los Angeles, CA 90015; plus NY, Santa Monica, San Diego.
- **Phone:** +1 310 388 6435.

**Qualification tuned for an app-dev agency** (replaces generic BANT):
- **Project type** — mobile / web / custom software / AI / MVP / fix-existing
- **Platform** — iOS, Android, web, cross-platform
- **Budget** — anchor against ~$5k design + dev range
- **Timeline** — urgency / launch date (30-day MVP is a hook)
- **Decision-maker** — founder / PM / exec
- **Need** — what problem the app solves; existing app vs. greenfield

## 5. Data model — Lead object

```ts
type Lead = {
  contact: { name?: string; email?: string; phone?: string; company?: string };
  qualification: {
    projectType?: "mobile" | "web" | "custom" | "ai" | "mvp" | "fix-existing";
    platform?: string;    // iOS, Android, web, cross-platform
    budget?: string;      // anchor vs ~$5k design + dev
    timeline?: string;    // urgency / launch date
    decisionMaker?: string; // founder / PM / exec
    need?: string;        // problem the app solves; greenfield vs existing
  };
  score?: number;         // 0–100, set by scoreLead()
  status: "in_progress" | "qualified" | "unqualified" | "handed_off";
  nextSteps?: string;
  transcript: { role: "agent" | "lead"; text: string }[];
};
```

## 6. System prompt notes (from OpenAI guidance)

- Use **labeled sections**: Role & Objective, Personality & Tone, Tools, Entity Capture, Unclear Audio.
- Keep replies short — **2–3 sentences**, natural pace.
- **Confirm exact identifiers** (email, phone) digit-by-digit before saving.
- Use **preambles** ("let me note that down") to mask latency.
- Structure the call into **phases with explicit exit criteria** (greeting → discovery → qualification → wrap-up/handoff).
- Avoid rigid "always/never" unless behavior truly requires it.

## 7. Build checklist

### Prep (gate everything on this)
- [ ] **OpenAI account has Realtime API access** + an API key ready
- [ ] Add `OPENAI_API_KEY` to Vercel env vars (Production + Preview, marked secret)
- [x] Repo synced locally
- [ ] Decide **CRM sink** — real (HubSpot/Airtable) vs. faked in-memory table. Hackathon: fake it convincingly.
- [ ] Decide **handoff channel** — Slack webhook is the easiest impressive demo

### Scaffold
- [x] **Scrape `appmakersla.com` → `src/data/company-kb.md`** — done 2026-06-26
- [x] ~~`npm install @openai/agents zod`~~ — N/A, team went raw-WebRTC (no SDK)
- [x] Server route `POST /api/realtime/session` → mint ephemeral token — **done by team**
- [x] Browser WebRTC connect + mic permission/selection UI — **done by team**
- [x] Live transcript (user + agent) + tool-activity panel — **done by team**
- [ ] **Resolve branding** (Mightybyte vs AppMakers) and write real `agentConfig.instructions`
- [ ] **Wire company KB** into instructions (condensed) and/or a `lookup_company_info` tool
- [ ] Define lead tools: `capture_lead_field`, `score_lead`, `handoff_to_human` (replace `get_project_status`)
- [ ] **Lead state** strategy — server session vs client accumulation
- [ ] Lead-card UI (shows qualification fields filling in real time)
- [ ] End-of-call summary + score + next steps
- [ ] CRM write (real or faked)
- [ ] Handoff trigger (Slack/SMS) with on-stage notification

### Demo polish
- [ ] 3-min demo script: live call → watch lead card fill → score crosses threshold → "let me bring in a specialist" → Slack ping fires on screen

## 8. Open decisions

- **Agent identity:** ✅ **RESOLVED — AppMakersLA.** Rebrand `config.ts`/`Agent.tsx` away from "Mightybyte"; agent represents AppMakers using `company-kb.md`.
- **Lead state:** server-side session store vs client-side accumulation across the call.
- **Input channel:** browser mic (recommended for hackathon) vs. real phone via Twilio (more impressive, more risk).
- **CRM:** real integration vs. faked table.
- **Handoff channel:** Slack webhook / SMS (Twilio) / calendar invite.
- **Scoring logic:** LLM-judged vs. rule-based weights on BANT fields.

## 9. Risks

- `next@16.3.0-canary.68` is a **canary release** — first suspect if a Vercel build fails on install/build.
- Realtime API access may need to be enabled on the OpenAI account.
- WebRTC mic permissions / autoplay can be finicky in some browsers — test early.