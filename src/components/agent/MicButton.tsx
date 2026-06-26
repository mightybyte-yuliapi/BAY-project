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
  // When true, the start action is blocked (e.g. no valid contact info yet).
  // Ignored while connected, so the user can always end an active call.
  disabled?: boolean;
  // Smaller pill for the pinned top bar.
  compact?: boolean;
};

export function MicButton({
  status,
  onConnect,
  onDisconnect,
  disabled = false,
  compact = false,
}: Props) {
  const connecting = status === "connecting";
  const connected = status === "connected";
  // Block starting when gated; never block ending a live call.
  const isDisabled = connecting || (disabled && !connected);
  const iconSize = compact ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      type="button"
      onClick={connected ? onDisconnect : onConnect}
      disabled={isDisabled}
      className={cn(
        "flex items-center gap-2.5 rounded-full font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
        compact ? "h-10 px-5 text-sm" : "h-14 px-8 text-base",
        connected
          ? "bg-zinc-800 ring-1 ring-zinc-700 hover:bg-zinc-700"
          : "bg-[#ea175c] shadow-[0_8px_30px_-6px_rgba(234,23,92,0.7)] hover:bg-[#ff2a6d]",
      )}
    >
      {connecting ? (
        <Loader2 className={cn(iconSize, "animate-spin")} />
      ) : connected ? (
        <MicOff className={iconSize} />
      ) : (
        <Mic className={iconSize} />
      )}
      {connecting ? "Connecting…" : connected ? "End conversation" : "Start talking"}
    </button>
  );
}
