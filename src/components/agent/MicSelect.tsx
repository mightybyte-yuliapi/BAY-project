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
      <span className="text-zinc-400">Microphone</span>
      <select
        value={selectedId}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-zinc-100 outline-none transition-colors focus:border-[#ea175c] disabled:opacity-50"
      >
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900">
            {d.label || "Microphone"}
          </option>
        ))}
      </select>
    </label>
  );
}
