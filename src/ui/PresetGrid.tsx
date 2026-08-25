import type { PresetId } from "../audio/presets";
import { PRESETS } from "../audio/presets";
import type { Lang } from "../i18n";

export function PresetGrid({
  active,
  onSelect,
  lang,
}: {
  active: PresetId;
  onSelect: (id: PresetId) => void;
  lang: Lang;
}) {
  const order: PresetId[] = ["warm", "broadcast", "natural", "custom"];
  return (
    <div className="grid grid-cols-2 gap-2">
      {order.map((id) => {
        const p = PRESETS[id];
        const selected = id === active;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`rounded-xl border p-3 text-left transition-all ${
              selected
                ? "border-emerald-400/70 bg-emerald-400/10 shadow-[0_0_18px_rgba(52,211,153,0.15)]"
                : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-sm font-semibold ${
                  selected ? "text-emerald-300" : "text-zinc-200"
                }`}
              >
                {lang === "th" ? p.nameTh : p.nameEn}
              </span>
              {selected && (
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-zinc-500">
              {lang === "th" ? p.descTh : p.descEn}
            </p>
          </button>
        );
      })}
    </div>
  );
}
