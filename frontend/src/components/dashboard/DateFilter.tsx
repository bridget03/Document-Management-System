import { useState } from "react";
import Button from "../ui/Button";

export type Preset = "7d" | "30d" | "month" | "3m" | "12m" | "custom";

export interface Range {
  from?: string;
  to?: string;
}

const PRESETS: { value: Exclude<Preset, "custom">; label: string }[] = [
  { value: "7d", label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
  { value: "month", label: "Tháng này" },
  { value: "3m", label: "3 tháng" },
  { value: "12m", label: "12 tháng" },
];

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function presetRange(p: Exclude<Preset, "custom">): Range {
  const today = new Date();
  const to = toISO(today);
  if (p === "7d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: toISO(from), to };
  }
  if (p === "30d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from: toISO(from), to };
  }
  if (p === "month") {
    return { from: `${to.slice(0, 8)}01`, to };
  }
  const from = new Date(today);
  from.setMonth(from.getMonth() - (p === "3m" ? 3 : 12));
  return { from: toISO(from), to };
}

export default function DateFilter({
  preset,
  onPreset,
  range,
  onCustom,
}: {
  preset: Preset;
  onPreset: (p: Preset) => void;
  range: Range;
  onCustom: (r: Range) => void;
}) {
  const [from, setFrom] = useState(range.from || "");
  const [to, setTo] = useState(range.to || "");

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Khoảng thời gian"
    >
      {PRESETS.map((p) => (
        <Button
          key={p.value}
          size="sm"
          variant={preset === p.value ? "primary" : "secondary"}
          onClick={() => onPreset(p.value)}
          className={
            preset === p.value
              ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }
        >
          {p.label}
        </Button>
      ))}
      <span className="flex items-center gap-1.5 text-xs text-gray-500">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
          aria-label="Từ ngày"
        />
        –
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
          aria-label="Đến ngày"
        />
        <Button
          size="sm"
          variant={preset === "custom" ? "primary" : "secondary"}
          disabled={!from || !to}
          onClick={() => {
            onCustom({ from, to });
            onPreset("custom");
          }}
        >
          Áp dụng
        </Button>
      </span>
    </div>
  );
}
