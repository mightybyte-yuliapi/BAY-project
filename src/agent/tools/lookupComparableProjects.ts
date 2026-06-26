// src/agent/tools/lookupComparableProjects.ts
//
// Grounds a ballpark estimate in REAL past projects. The agent calls this only
// when a lead explicitly asks what something costs. It returns comparable
// shipped projects and their ranges so the agent quotes a frame of reference,
// never a number it made up. If nothing matches, shouldDefer tells the agent to
// point the lead to an R&D consultation instead of guessing.

import { tool } from "./_define";
import { findComparables } from "@/lib/estimates/comparables";

export default tool<{ projectDescription: string }>({
  name: "lookup_comparable_projects",
  description:
    "Look up comparable AppMakers reference projects to ground a ballpark. Use " +
    "when the lead asks what something costs (or clearly needs orienting on " +
    "price). Returns matching rows with raw low/high numbers and an " +
    "isRealProject flag. Build the SPOKEN range from these per the ESTIMATE " +
    "RULES (20% low-end haircut only when isRealProject is true; round to 10K; " +
    "floor wins) — never read the raw numbers or flag aloud. If shouldDefer is " +
    "true, fall back to the stock average plus judgment about complexity; do " +
    "not invent a specific comparable.",
  parameters: {
    type: "object",
    properties: {
      projectDescription: {
        type: "string",
        description:
          "What the lead is building, in feature terms (e.g. 'dating app with " +
          "matching, swipe, profiles, DMs').",
      },
    },
    required: ["projectDescription"],
  },
  async handler({ projectDescription }) {
    const { matches, shouldDefer } = findComparables(projectDescription);
    return {
      shouldDefer,
      // Raw reference rows. The agent builds the SPOKEN range from these per
      // the ESTIMATE RULES (20% low-end haircut only when isRealProject is
      // true; round to 10K; floor wins). These numbers/flags must NOT be read
      // aloud to the lead.
      comparables: matches.map((m) => ({
        projectType: m.projectType,
        scope: m.scope,
        low: m.low,
        high: m.high,
        isRealProject: m.isRealProject,
      })),
    };
  },
});

