// src/lib/estimates/comparables.ts
//
// ─────────────────────────────────────────────────────────────────────────
// STUB — owned by the PM / estimate-data dev.
// The agent grounds ballpark ranges in REAL past projects. The PM will send
// estimate info (and a scraped .md of shipped work). For now this is a small
// hardcoded fixture. Replace `findComparables` internals to read the real
// source — keep the function signature and return shape so the tool/agent
// don't change.
// ─────────────────────────────────────────────────────────────────────────

export type Comparable = {
  // Short name of a past project shape.
  kind: string;
  // Feature keywords used to match against what the lead describes.
  keywords: string[];
  // Honest range from real shipped work. High end carries "+".
  range: string;
  // One-line description for the agent to reference.
  note: string;
};

// TODO(estimate-data): replace with real comparables from the scraped .md.
const FIXTURE: Comparable[] = [
  {
    kind: "Dating / matching app",
    keywords: ["dating", "match", "swipe", "profiles", "dm", "messaging"],
    range: "$50K–$80K+",
    note: "Tinder-style: matching, swipe, profiles, DMs, admin panel.",
  },
  {
    kind: "Marketplace (two-sided)",
    keywords: ["marketplace", "buyers", "sellers", "listings", "payments"],
    range: "$70K–$120K+",
    note: "Two-sided marketplace with listings, payments, ratings.",
  },
  {
    kind: "On-demand services app",
    keywords: ["on-demand", "booking", "delivery", "drivers", "tracking"],
    range: "$60K–$110K+",
    note: "Uber-style: booking, real-time tracking, driver + customer apps.",
  },
  {
    kind: "SaaS dashboard / B2B tool",
    keywords: ["saas", "dashboard", "b2b", "analytics", "admin", "subscription"],
    range: "$60K–$130K+",
    note: "Web SaaS with auth, billing, dashboards, role-based admin.",
  },
  {
    kind: "AI-powered product",
    keywords: ["ai", "ml", "llm", "chatbot", "recommendation", "vision"],
    range: "$80K–$150K+",
    note: "Custom AI feature layered on a product; scope varies widely.",
  },
];

export type ComparablesResult = {
  matches: Comparable[];
  // True when nothing matched well — agent should DEFER, not invent a number.
  shouldDefer: boolean;
};

/**
 * Find comparable past projects by feature description. Returns matches ranked
 * by keyword overlap. If nothing matches confidently, shouldDefer is true and
 * the agent should point the lead to an R&D consultation instead of guessing.
 */
export function findComparables(description: string): ComparablesResult {
  const text = description.toLowerCase();
  const scored = FIXTURE.map((c) => ({
    c,
    score: c.keywords.filter((k) => text.includes(k)).length,
  })).filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score);
  const matches = scored.slice(0, 2).map((s) => s.c);

  return { matches, shouldDefer: matches.length === 0 };
}
