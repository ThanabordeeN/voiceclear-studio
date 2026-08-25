import type { PresetId } from "../audio/presets";
import { PRESETS } from "../audio/presets";
import type { Lang } from "../i18n";

/** Per-preset status dot colour (PPotfolio-style live/beta/dev palette). */
const DOT_COLOR: Record<PresetId, string> = {
  warm: "#34a853",
  broadcast: "#fbbc05",
  natural: "#4285f4",
  custom: "#a142f4",
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
    <div className="grid grid-cols-2 gap-2">
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