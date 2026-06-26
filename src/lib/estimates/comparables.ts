// src/lib/estimates/comparables.ts
//
// The estimate reference data. The agent grounds ballpark ranges in real past
// AppMakers projects (and a few generic category averages). Source of truth is
// src/data/appmakers_project_reference.csv, which the team maintains.
//
// This module only RETRIEVES and ranks rows. It does NOT do the pricing math —
// the agent applies the spoken-range rules from the system prompt (the 20%
// optimistic-MVP haircut on real projects, rounding to 10K, floor, etc.) so
// that logic lives in one place and the raw numbers never reach the lead.
//
// Server-only (imported by the tools dispatcher), so reading the file at module
// load is fine.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Comparable = {
  // Short label for the kind of project.
  projectType: string;
  // Full scope description (used both for matching and as agent reference).
  scope: string;
  // Raw reference numbers from the file. The agent converts these into a
  // spoken range per the prompt rules — they are NEVER surfaced to the lead.
  low: number;
  high: number;
  // "yes" = a specific shipped project (apply the 20% low-end haircut, may be
  // referenced as real work). "no" = a generic category average (speak as-is,
  // do NOT claim as a specific build).
  isRealProject: boolean;
};

// Minimal CSV parser that handles quoted fields containing commas/newlines.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (field !== "" || row.length) {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      }
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Load + parse the reference file once at module load.
const COMPARABLES: Comparable[] = (() => {
  try {
    const text = readFileSync(
      join(process.cwd(), "src/data/appmakers_project_reference.csv"),
      "utf8",
    );
    const [, ...dataRows] = parseCsv(text); // skip header
    return dataRows
      .filter((r) => r.length >= 5 && r[0].trim())
      .map((r) => ({
        projectType: r[0].trim(),
        scope: r[1].trim(),
        low: Number(r[2]),
        high: Number(r[3]),
        isRealProject: r[4].trim().toLowerCase() === "yes",
      }));
  } catch {
    return [];
  }
})();

export type ComparablesResult = {
  matches: Comparable[];
  // True when nothing matched well — the agent should fall back to the stock
  // average + judgment (per the prompt), not invent a specific comparable.
  shouldDefer: boolean;
};

// Words too generic to be useful signal when matching a description.
const STOP_WORDS = new Set([
  "app","application","mobile","ios","android","web","the","and","for","with",
  "that","this","build","building","want","need","features","feature","system",
  "platform","user","users","custom","software","a","an","to","of","in","on",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Find comparable reference projects by feature/keyword overlap with the lead's
 * description. Returns the best 1-2 matches with their RAW numbers and the
 * is_real_project flag so the agent can build a spoken range per the prompt.
 * If nothing overlaps meaningfully, shouldDefer is true.
 */
export function findComparables(description: string): ComparablesResult {
  const wanted = tokenize(description);
  if (wanted.length === 0 || COMPARABLES.length === 0) {
    return { matches: [], shouldDefer: true };
  }

  const scored = COMPARABLES.map((c) => {
    const haystack = `${c.projectType} ${c.scope}`.toLowerCase();
    const score = wanted.reduce(
      (n, w) => n + (haystack.includes(w) ? 1 : 0),
      0,
    );
    return { c, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Require at least a small amount of real overlap to count as a match.
  const strong = scored.filter((s) => s.score >= 2);
  const matches = (strong.length ? strong : scored).slice(0, 2).map((s) => s.c);

  return { matches, shouldDefer: matches.length === 0 };
}
