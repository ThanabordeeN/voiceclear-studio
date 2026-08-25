import type { PresetId } from "../audio/presets";
import { PRESETS } from "../audio/presets";
import type { Lang } from "../i18n";

/** Per-preset status dot colour (PPotfolio-style live/beta/dev palette). */
const DOT_COLOR: Record<PresetId, string> = {
  warm: "#ff9500",
  broadcast: "#ff6b00",
  natural: "#8e8e93",
  custom: "#c75b12",
};

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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {order.map((id) => {
        const p = PRESETS[id];
        const selected = id === active;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`preset-card ${selected ? "active" : ""}`}
          >
            <span className="preset-name">
              {lang === "th" ? p.nameTh : p.nameEn}
              <span
                className="preset-dot"
                style={{ backgroundColor: DOT_COLOR[id] }}
              />
            </span>
            <span className="preset-desc">
              {lang === "th" ? p.descTh : p.descEn}
            </span>
          </button>
        );
      })}
    </div>
  );
}