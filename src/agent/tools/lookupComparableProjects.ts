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
    "Look up comparable past AppMakers projects and their cost ranges to " +
    "ground a ballpark. Use ONLY when the lead explicitly asks what something " +
    "might cost. Returns real comparables to reference as a frame of reference " +
    "(never a quote). If shouldDefer is true, do NOT invent a number — point " +
    "them to an R&D consultation with Aaron.",
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
      comparables: matches.map((m) => ({
        kind: m.kind,
        range: m.range,
        note: m.note,
      })),
    };
  },
});
