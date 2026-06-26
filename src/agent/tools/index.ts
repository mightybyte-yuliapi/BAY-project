// src/agent/tools/index.ts
//
// Tool registry. Add every tool here — one import + one line in the array.
// Nothing else needs to change to add a new capability.

import type { RealtimeToolSchema, ToolDefinition } from "./_define";
import getProjectStatus from "./getProjectStatus";

// 👇 Register tools here.
export const tools: ToolDefinition<any, any>[] = [getProjectStatus];

// Lookup by name, used by the backend dispatcher.
const toolsByName = new Map(tools.map((t) => [t.name, t]));

export function getTool(name: string): ToolDefinition<any, any> | undefined {
  return toolsByName.get(name);
}

/** The schemas the Realtime session advertises to the model (no handlers). */
export function getToolSchemas(): RealtimeToolSchema[] {
  return tools.map((t) => ({
    type: "function",
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

/** Execute a tool by name with parsed arguments. Throws if unknown. */
export async function runTool(name: string, args: unknown): Promise<unknown> {
  const t = getTool(name);
  if (!t) throw new Error(`Unknown tool: ${name}`);
  return t.handler((args ?? {}) as Record<string, unknown>);
}
