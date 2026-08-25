/** Small styled primitives shared by the studio UI. */

import type { ReactNode } from "react";

export function Toggle({
  label,
  on,
  onChange,
  disabled = false,
  accent = "emerald",
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  accent?: "emerald" | "amber";
}) {
  const active =
    accent === "emerald"
      ? "bg-emerald-500 shadow-[0_0_12px_rgba(52,211,153,0.45)]"
      : "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.45)]";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
        on
          ? "border-zinc-600 bg-zinc-800 text-zinc-100"
          : "border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:border-zinc-700"
      } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
    >
      <span
        className={`relative h-4 w-7 rounded-full transition-colors ${
          on ? active : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
            on ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
      {label}
    </button>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`block ${disabled ? "opacity-40" : ""}`}
      aria-disabled={disabled}
    >
      <span className="mb-1 flex items-baseline justify-between text-xs text-zinc-400">
        {label}
        <span className="font-mono text-zinc-300">
          {value.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0)}
          {unit ? ` ${unit}` : ""}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-emerald-400
                   [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-emerald-400"
      />
    </label>
  );
}

export function Panel({
  title,
  icon,
  children,
  className = "",
}: {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-4 backdrop-blur ${className}`}
    >
      {title && (
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest text-zinc-400 uppercase">
          {icon}
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
