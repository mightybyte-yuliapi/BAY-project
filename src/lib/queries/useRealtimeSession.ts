// src/lib/queries/useRealtimeSession.ts
//
// React Query mutation that asks our backend to mint an ephemeral Realtime
// client secret. Server state — the secret is async, short-lived, and fetched.

import { useMutation } from "@tanstack/react-query";

export type RealtimeSession = {
  // The ephemeral client secret object returned by OpenAI. Shape is opaque
  // to us; we hand its `value` to the WebRTC connection.
  clientSecret: { value: string; expires_at?: number } & Record<string, unknown>;
  model: string;
};

// The lead's contact info, captured before the call and passed to the session
// so the agent knows how to reach them (and can include it in the report).
export type SessionContact = { email?: string; phone?: string };

async function mintSession(contact?: SessionContact): Promise<RealtimeSession> {
  const res = await fetch("/api/realtime/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contact: contact ?? {} }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error ?? "Failed to start session.");
  }
  return res.json();
}

export function useRealtimeSession() {
  return useMutation({ mutationFn: (contact?: SessionContact) => mintSession(contact) });
}
