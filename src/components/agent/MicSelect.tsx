// src/components/agent/MicSelect.tsx
//
// Lets the user pick which microphone to use. Single-purpose: a labeled
// <select> over the available input devices. Important because browsers may
// default to a silent virtual device (e.g. ZoomAudioDevice).

type Props = {
  devices: MediaDeviceInfo[];
  selectedId: string;
  onChange: (deviceId: string) => void;
  disabled?: boolean;
};

export function MicSelect({ devices, selectedId, onChange, disabled }: Props) {
  if (devices.length === 0) return null;

  return (
    <label className="flex w-full max-w-sm flex-col gap-1 text-sm">
      <span className="text-zinc-500">Microphone</span>
      <select
        value={selectedId}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-800 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || "Microphone"}
          </option>
        ))}
      </select>
    </label>
  );
}
