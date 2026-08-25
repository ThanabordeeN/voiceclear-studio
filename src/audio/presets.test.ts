import { describe, expect, it } from "vitest";
import { PRESETS, DEFAULT_PRESET_ID, type DspParams } from "./presets";

describe("presets", () => {
  it("has exactly the 4 defined preset ids", () => {
    expect(Object.keys(PRESETS).sort()).toEqual([
      "broadcast",
      "custom",
      "natural",
      "warm",
    ]);
  });

  it("defaults to Krisp Studio Warm", () => {
    expect(DEFAULT_PRESET_ID).toBe("warm");
  });

  it("'warm' matches spec §4 DSP values exactly", () => {
    const p: DspParams = PRESETS.warm.dsp;
    // Stage 3: Highpass
    expect(p.hpFreq).toBe(55);
    expect(p.hpQ).toBeCloseTo(0.707);
    // Stage 4: Deep Bass Shelf
    expect(p.lowshelfFreq).toBe(130);
    expect(p.lowshelfGain).toBeCloseTo(3.8);
    // Stage 5: Vocal Body
    expect(p.bodyFreq).toBe(220);
    expect(p.bodyQ).toBeCloseTo(0.85);
    expect(p.bodyGain).toBeCloseTo(3.2);
    // Stage 6: Anti-Mud Cut
    expect(p.mudFreq).toBe(500);
    expect(p.mudQ).toBeCloseTo(1.4);
    expect(p.mudGain).toBeCloseTo(-2.0);
    // Stage 7: Edge Softener
    expect(p.harshFreq).toBe(4500);
    expect(p.harshQ).toBeCloseTo(1.2);
    expect(p.harshGain).toBeCloseTo(-1.8);
    // Stage 8: Vocal Compressor
    expect(p.compThreshold).toBe(-16);
    expect(p.compRatio).toBe(2.5);
    expect(p.compAttack).toBe(0.015); // seconds (Web Audio unit)
    expect(p.compRelease).toBe(0.1); // seconds
    // Stage 9: Limiter ceiling
    expect(p.limiterCeilingDb).toBe(-1.5);
    // AI denoise strength full for warm profile
    expect(p.denoiseStrength).toBeCloseTo(0.85);
  });

  it("'broadcast' cuts mud harder and highpasses at 60 Hz", () => {
    const b = PRESETS.broadcast.dsp;
    const w = PRESETS.warm.dsp;
    expect(b.hpFreq).toBe(60);
    expect(b.mudGain).toBeLessThan(w.mudGain);
    expect(b.bodyGain).toBeLessThan(w.bodyGain); // less warmth, more clarity
  });

  it("'natural' keeps EQ flat and uses medium denoise strength", () => {
    const n = PRESETS.natural.dsp;
    expect(n.lowshelfGain).toBe(0);
    expect(n.bodyGain).toBe(0);
    expect(n.mudGain).toBe(0);
    expect(n.harshGain).toBe(0);
    expect(n.denoiseStrength).toBeGreaterThan(0);
    expect(n.denoiseStrength).toBeLessThan(PRESETS.warm.dsp.denoiseStrength);
  });

  it("'custom' starts from the warm baseline", () => {
    expect(PRESETS.custom.dsp).toEqual(PRESETS.warm.dsp);
  });
});
