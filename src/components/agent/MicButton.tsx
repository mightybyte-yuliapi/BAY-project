// src/components/agent/MicButton.tsx
//
// Start / stop control for the conversation. Single-purpose: just renders a
// button reflecting connection state and calls the handlers it's given.

import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/lib/realtime/useRealtimeAgent";

type Props = {
  status: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function MicButton({ status, onConnect, onDisconnect }: Props) {
  const connecting = status === "connecting";
  const connected = status === "connected";

  return (
    <button
      type="button"
      onClick={connected ? onDisconnect : onConnect}
      disabled={connecting}
      className={cn(
        "flex h-14 items-center gap-2 rounded-full px-7 text-base font-medium text-white shadow-md transition-colors disabled:opacity-60",
        connected
          ? "bg-red-600 hover:bg-red-700"
          : "bg-violet-600 hover:bg-violet-700",
      )}
    >
      {connecting ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : connected ? (
        <MicOff className="h-5 w-5" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
      {connecting ? "Connecting…" : connected ? "End conversation" : "Start talking"}
    </button>
  );
}
