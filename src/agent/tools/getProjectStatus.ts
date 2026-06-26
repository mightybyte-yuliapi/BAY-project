// src/agent/tools/getProjectStatus.ts
//
// Example tool. Shows the pattern: schema (what the model sees) + handler
// (what runs on the backend). Replace the handler body with a real lookup
// (DB query, internal API call, etc.).

import { tool } from "./_define";

export default tool<{ projectName: string }>({
  name: "get_project_status",
  description:
    "Look up the current status of a Mightybyte project by its name. " +
    "Call this when the user asks how a project is doing or what phase it is in.",
  parameters: {
    type: "object",
    properties: {
      projectName: {
        type: "string",
        description: "The name of the project to look up.",
      },
    },
    required: ["projectName"],
  },
  // Runs on the BACKEND only. Safe to use secrets / DB here.
  async handler({ projectName }) {
    // TODO: replace with a real data source.
    return {
      project: projectName,
      status: "On track",
      phase: "Design",
      updatedAt: "2026-06-26",
    };
  },
});
