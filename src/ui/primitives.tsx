/** Apple-style primitives shared by the studio UI. */

import type { ReactNode } from "react";

export function Toggle({
  label,
  on,
  onChange,
  disabled = false,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="switch"
    >
      <span className={`sw-track ${on ? "on" : ""}`}>
        <span className="sw-knob" />
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
    <label className={`block ${disabled ? "opacity-40" : ""}`}>
      <span className="mb-1 flex items-baseline justify-between">
        <span className="slider-label">{label}</span>
        <span className="slider-val">
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
        className="slider"
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
    <section className={`card card-pad ${className}`}>
      {title && (
        <h2 className="card-title">
          {icon}
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}