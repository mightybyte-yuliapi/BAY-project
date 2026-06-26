# AppMakers USA — Company Knowledge Base

> Curated knowledge base for the AI Lead Call Agent. Source: appmakersla.com (scraped 2026-06-26).
> The agent uses this to speak credibly as AppMakers, answer prospect questions, and qualify leads.
> **This is a static snapshot — re-scrape to update. Do not fetch the site live during a call.**

## Who we are

AppMakers USA (AppMakersLA) is a mobile app, web, and custom software development agency
serving both startups and established enterprises. We consider ourselves a startup app
development company — we build for startups and big firms alike. Every project includes
full QA and a dedicated product manager.

- **Headquarters:** 1250 S Los Angeles St #223, Los Angeles, CA 90015
- **Other offices:** Santa Monica, New York, San Diego (plus distributed global developers)
- **We answer our phones** and typically respond within **30 minutes**.

## Services

| Service | What it is |
|---|---|
| **Custom Software Development** | Bespoke software for unique business challenges. |
| **Mobile App Development** | Full iOS + Android app development. |
| **Web App Development** | Responsive, feature-rich web applications. |
| **Artificial Intelligence** | AI solutions from intelligent automation to ML, tailored to the app. |
| **iOS Development** | iPhone/iPad apps, native Swift + cross-platform. |
| **Android Development** | High-performance Android apps. |
| **Low-Code/No-Code** | Rapid builds via Bubble, Webflow — no heavy traditional coding. |
| **30-Day MVP** | Working MVP in 30 days using AI + senior engineers. *(Key hook for early-stage leads.)* |
| **Staff Augmentation** | On-demand tech talent to extend a client's team. |
| **Fix Your App** | Rescue/debug service — "Vibe-coded an app which crashes now? We can help." |

Service pages: `appmakersla.com/services/<slug>` (e.g. `/services/30-day-mvp/`, `/services/fix-your-app/`).

## Tech stack

- **Frontend:** React, Vue, Next.js
- **Mobile:** React Native, Flutter, Swift (native iOS), Android
- **Backend:** Node, Python, Java
- **Databases:** MongoDB, MySQL
- **Cloud / DevOps:** AWS, GCP; GitHub + GitLab for version control; Firebase for crash reporting
- **Low-code:** Bubble, Webflow
- **Design:** Figma

## Our process

**Phase A — Research & Development**
- **A1 Specifications & Planning** — discovery sessions, detailed spec doc; what to build, target users, features; 80/20 prioritization; cost-efficient stack selection.
- **A2 Design, Wireframe & Prototype** — Figma wireframes + interactive prototypes; client review/iteration before development.
- **A3 Estimates & Timeline** — project cost estimate + deployment timeline; budget flexible via feature scope.

**Phase B — Development**
- **B1 Build** — Lean methodology, rapid feature releases for early testing.
- **B2 Test** — manual testing on real iOS/Android/browser devices + automation + unit tests.
- **B3 Deploy** — code to client-accessible GitLab repo; automated testing + crash reporting (Firebase, DevOps).
- **B4 Measure** — client + user feedback; beta testing for existing apps.
- **B5 Maintain** — three support models: hourly, retainer, or custom.

## Pricing anchors

> Always frame as "depends on scope" and push toward a free consultation for a real estimate.

- **Design phase:** ~2 weeks, ~$5,000.
- **Overall:** cost varies by project; free consultation provided.
- Reference points the agent can cite if asked (from our FAQ/market guidance):
  - **Dating app MVP:** ~12–16 weeks; basic MVP $5,000–$25,000; full-featured $80,000–$100,000+.
  - **Fintech app:** basic ~$50,000; advanced (AI/blockchain) $300,000+; timeline 3–24 months.
  - **AI customer-support deployment:** typically 4–12 weeks to deploy.

## Notable clients

Walmart, US Bank, BMW, Sony, ServiceNow, Home Depot.

## Portfolio highlights

We've shipped 50+ projects across 35+ categories. Representative work:

| Project | Category | What we built |
|---|---|---|
| Walmart | E-Commerce, Food & Delivery | Grocery delivery + curbside pickup app |
| My Fitness Pal | Health | Food tracking, calorie counter, fitness tracker |
| Uklon | Ride share | Rider + driver ride-sharing apps |
| GlucoCoachAI | AI, Health | AI diabetes coach with personalized meal plans |
| iCardio.ai | AI, Health | AI-powered medical ultrasound imaging |
| Echo Journal | AI, Productivity | Voice journaling with AI analysis/summaries |
| Toffy | AI, Education | AI dog-training & pet-care platform |
| ClassCalc | Education | Graphing calculator with lockdown browser |
| Hive | Productivity | Team communication & workflow platform |
| Path.Wellness | Health | Women's wellness tracking 40+ metrics |
| ShiftPass | Hospitality | Restaurant job marketplace |
| Stick Cricket | Games | Multiplayer cricket gaming platform |

**Portfolio categories:** AI, Automotive, Blockchain, Bubble, Community, Construction, CRM,
Dating, E-Commerce, E-Sports, Education, Entertainment, Fashion, Finance, Food & Delivery,
Games, Health, Home Improvement, Hospitality, IoT, Management, Music, Productivity, Real-Estate,
Ride share, Social Media, Sports, Streaming, Telecommunication, Wellness, and more.

Full portfolio: `appmakersla.com/portfolio`

## Common prospect questions (from our FAQ)

- **Native vs cross-platform?** Native suits device-specific features + max performance; cross-platform offers faster time-to-market.
- **Can I start basic and scale?** Yes — modular development; launch an MVP and add features as the user base grows.
- **Integrate with existing systems?** Yes — CRMs, ERPs, payment gateways, custom backends.
- **App store rejections?** We manage Apple/Google submissions, troubleshoot, and resubmit.
- **Post-launch support?** Performance monitoring, updates, feature enhancements, OS adaptation.
- **Where are developers located?** Mainly LA HQ, with offices worldwide; we hire the best developers anywhere.
- **How much do you charge?** Cost varies by project — book a consultation for a prompt estimate.
- **Build for startups?** Yes — we consider ourselves a startup app development company.

## Contact

- **Phone (main / Santa Monica):** +1 310-388-6435
- **Los Angeles:** +1 213-376-5724 · **New York:** +1 718-775-3064 · **San Diego:** +1 619-329-9273
- **Consultation:** contact form on the site; we respond within ~30 minutes.
- **Social:** Instagram @appmakers.usa · X @appmakers_usa · LinkedIn "App Makers USA" · Facebook · Reddit · WhatsApp

## TBD / Later

Things intentionally deferred — revisit if the demo needs them:

- **Broad FAQ / industry content (excluded for now).** The live FAQ page has extensive generic
  AI & industry Q&A (dating apps, fintech, legal/law, customer-support/CRM, code validation,
  soft-launch) that reads more like SEO blog material than AppMakers facts. Left out to keep the
  qualification agent focused. If we want the agent to handle broad "how does AI work" tangents,
  add a trimmed slice here later. Source: `appmakersla.com/faq`.
- **Condensed prompt summary** (~150 words) to inject into the agent's system prompt — still TODO.
- **`lookupCompanyInfo(topic)` tool** vs. full-KB injection — decide which retrieval approach to use.
- **Re-scrape cadence** — this is a static snapshot (2026-06-26); no refresh mechanism yet.

## How the agent should use this

- Speak as a knowledgeable AppMakers representative — warm, concise, credible.
- When a prospect describes a project, map it to a **service** and relevant **portfolio** examples.
- Use the **30-Day MVP** as a hook for early-stage founders; **Fix Your App** for broken/inherited apps.
- Give **pricing as ranges anchored to scope**, then steer toward a free consultation.
- Never invent clients, prices, or capabilities beyond what's listed here.
