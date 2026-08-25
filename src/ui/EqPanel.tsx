import type { DspParams } from "../audio/presets";
import type { T } from "../i18n";
import { Slider } from "./primitives";

/** Custom EQ / dynamics panel — enabled only for the Custom profile. */
export function EqPanel({
  params,
  onPatch,
  disabled,
  t,
}: {
  params: DspParams;
  onPatch: (patch: Partial<DspParams>) => void;
  disabled: boolean;
  t: T;
}) {
  return (
    <div className={`grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 ${disabled ? "pointer-events-none opacity-40" : ""}`}>
      <Slider
        label={t("denoise")}
        value={params.denoiseStrength}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => onPatch({ denoiseStrength: v })}
      />
      <Slider
        label={`${t("hp")} · Hz`}
        value={params.hpFreq}
        min={20}
        max={160}
        step={1}
        unit="Hz"
        onChange={(v) => onPatch({ hpFreq: v })}
      />
      <Slider
        label={`${t("bassShelf")} · dB`}
        value={params.lowshelfGain}
        min={-6}
        max={9}
        step={0.2}
        unit="dB"
        onChange={(v) => onPatch({ lowshelfGain: v })}
      />
      <Slider
        label={`${t("vocalBody")} · dB @ ${params.bodyFreq} Hz`}
        value={params.bodyGain}
        min={-6}
        max={9}
        step={0.2}
        unit="dB"
        onChange={(v) => onPatch({ bodyGain: v })}
      />
      <Slider
        label={`${t("mudCut")} · dB @ ${params.mudFreq} Hz`}
        value={params.mudGain}
        min={-9}
        max={6}
        step={0.2}
        unit="dB"
        onChange={(v) => onPatch({ mudGain: v })}
      />
      <Slider
        label={`${t("edgeSoftener")} · dB @ ${(params.harshFreq / 1000).toFixed(1)} kHz`}
        value={params.harshGain}
        min={-9}
        max={6}
        step={0.2}
        unit="dB"
        onChange={(v) => onPatch({ harshGain: v })}
      />
      <Slider
        label={`${t("compThreshold")}`}
        value={params.compThreshold}
        min={-48}
        max={0}
        step={1}
        unit="dB"
        onChange={(v) => onPatch({ compThreshold: v })}
      />
    </div>
  );
}
