/**
 * Preset profiles — single source of truth for all DSP parameter values.
 * Values for the default "warm" profile come verbatim from spec §4.
 */

export type DspParams = {
  /** Stage 2 — AI denoise VAD/strength, 0..1 */
  denoiseStrength: number;
  /** Stage 3 — Highpass filter */
  hpFreq: number;
  hpQ: number;
  /** Stage 4 — Deep bass lowshelf */
  lowshelfFreq: number;
  lowshelfGain: number; // dB
  /** Stage 5 — Vocal body peaking */
  bodyFreq: number;
  bodyQ: number;
  bodyGain: number; // dB
  /** Stage 6 — Anti-mud peaking */
  mudFreq: number;
  mudQ: number;
  mudGain: number; // dB
  /** Stage 7 — Edge softener peaking */
  harshFreq: number;
  harshQ: number;
  harshGain: number; // dB
  /** Stage 8 — Compressor */
  compThreshold: number; // dB
  compRatio: number;
  compAttack: number; // seconds
  compRelease: number; // seconds
  /** Stage 9 — Limiter ceiling in dBFS (negative) */
  limiterCeilingDb: number;
};

export type PresetId = "warm" | "broadcast" | "natural" | "custom";

export type Preset = {
  id: PresetId;
  nameEn: string;
  nameTh: string;
  descEn: string;
  descTh: string;
  dsp: DspParams;
};

/** Spec §4 baseline ("Krisp Studio Warm"). */
export const WARM_PARAMS: DspParams = {
  denoiseStrength: 0.85,
  hpFreq: 55,
  hpQ: 0.707,
  lowshelfFreq: 130,
  lowshelfGain: 3.8,
  bodyFreq: 220,
  bodyQ: 0.85,
  bodyGain: 3.2,
  mudFreq: 500,
  mudQ: 1.4,
  mudGain: -2.0,
  harshFreq: 4500,
  harshQ: 1.2,
  harshGain: -1.8,
  compThreshold: -16,
  compRatio: 2.5,
  compAttack: 0.015,
  compRelease: 0.1,
  limiterCeilingDb: -1.5,
};

const BROADCAST_PARAMS: DspParams = {
  ...WARM_PARAMS,
  denoiseStrength: 1.0,
  hpFreq: 60,
  lowshelfGain: 1.5,
  bodyGain: 1.5,
  mudGain: -4.0,
  harshGain: -3.0,
  compThreshold: -18,
  compRatio: 3,
};

const NATURAL_PARAMS: DspParams = {
  ...WARM_PARAMS,
  denoiseStrength: 0.55,
  lowshelfGain: 0,
  bodyGain: 0,
  mudGain: 0,
  harshGain: 0,
  compThreshold: -12,
  compRatio: 1.8,
};

export const PRESETS: Record<PresetId, Preset> = {
  warm: {
    id: "warm",
    nameEn: "Krisp Studio Warm",
    nameTh: "Krisp Studio Warm",
    descEn: "Deep denoise + warm velvet EQ + leveling. Podcasts & meetings.",
    descTh:
      "ตัดสัญญาณรบกวนลึก + EQ อุ่น + ปรับระดับเสียง เหมาะกับพอดแคสต์/ประชุม",
    dsp: WARM_PARAMS,
  },
  broadcast: {
    id: "broadcast",
    nameEn: "Broadcast Standard",
    nameTh: "Broadcast Standard",
    descEn: "Aggressive suppression + mud cut + HP 60 Hz. Crisp broadcast tone.",
    descTh: "ตัดเสียงรบกวนเด็ดขาด + Mud Cut + HP 60 Hz คมชัดแบบผู้ประกาศ",
    dsp: BROADCAST_PARAMS,
  },
  natural: {
    id: "natural",
    nameEn: "Clean Natural",
    nameTh: "Clean Natural",
    descEn: "Medium denoise, flat EQ — keeps your natural voice.",
    descTh: "AI ตัดเฉพาะเสียงพัดลม/แอร์ EQ แบน คงเนื้อเสียงเดิม",
    dsp: NATURAL_PARAMS,
  },
  custom: {
    id: "custom",
    nameEn: "Custom Profile",
    nameTh: "โปรไฟล์กำหนดเอง",
    descEn: "Tune every DSP stage yourself.",
    descTh: "ปรับค่า DSP ทุกขั้นตอนด้วยตัวเอง",
    dsp: { ...WARM_PARAMS },
  },
};

export const DEFAULT_PRESET_ID: PresetId = "warm";
