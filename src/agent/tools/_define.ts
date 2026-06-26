// src/agent/tools/_define.ts
//
// Helper + types for defining a tool. A tool is one self-contained unit:
//   - the SCHEMA the model sees (name / description / parameters)
//   - the HANDLER that runs on the BACKEND when the model calls it
//
// Add a new tool by creating a file next to this one that default-exports
// `tool({ ... })`, then register it in `index.ts`.

// JSON Schema describing the tool's parameters (what the model fills in).
export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

export type ToolDefinition<Args = Record<string, unknown>, Result = unknown> = {
  /** Snake_case name the model uses to call the tool. */
  name: string;
  /** Plain-English description — this guides the model on when to call it. */
  description: string;
  /** JSON Schema for the arguments. */
  parameters: JsonSchema;
  /**
   * Runs on the BACKEND. Has access to env secrets, DB, internal APIs.
   * Receives the parsed arguments, returns a JSON-serializable result.
   */
  handler: (args: Args) => Promise<Result> | Result;
};

/** Identity helper that gives you type inference + a consistent shape. */
export function tool<Args = Record<string, unknown>, Result = unknown>(
  def: ToolDefinition<Args, Result>,
): ToolDefinition<Args, Result> {
  return def;
}

/** The shape the Realtime session expects in `session.tools`. */
export type RealtimeToolSchema = {
  type: "function";
  name: string;
  description: string;
  parameters: JsonSchema;
};
