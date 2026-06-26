// src/app/api/realtime/tools/route.ts
//
// Executes a tool call on the BACKEND. When the model decides to call a
// function, the client relays { name, arguments } here; we run the tool's
// handler (which can use secrets / DB / internal APIs) and return the result.
// The client then forwards the result back into the Realtime session.

import { runTool } from "@/agent/tools";

type ToolCallRequest = {
  name: string;
  arguments: Record<string, unknown>;
};

export async function POST(request: Request) {
  let body: ToolCallRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { name, arguments: args } = body ?? {};
  if (!name || typeof name !== "string") {
    return Response.json({ error: "Missing tool name." }, { status: 400 });
  }

  try {
    const result = await runTool(name, args);
    return Response.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
