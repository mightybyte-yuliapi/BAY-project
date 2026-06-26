// src/lib/queries/useToolCall.ts
//
// React Query mutation that runs a tool on the backend. Server state — the
// tool result is async, fetched, and cacheable via the mutation.

import { useMutation } from "@tanstack/react-query";

export type ToolCallInput = {
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolCallResult = { result: unknown };

async function callTool(input: ToolCallInput): Promise<ToolCallResult> {
  const res = await fetch("/api/realtime/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error ?? "Tool call failed.");
  }
  return res.json();
}

export function useToolCall() {
  return useMutation({ mutationFn: callTool });
}
