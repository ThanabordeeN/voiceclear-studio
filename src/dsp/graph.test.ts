import { describe, expect, it } from "vitest";
import { dbToGain, makeSoftClipCurve } from "./graph";

describe("makeSoftClipCurve", () => {
  const curve = makeSoftClipCurve();

  it("has 4096 points spanning −1..+1", () => {
    expect(curve.length).toBe(4096);
    expect(curve[0]).toBeCloseTo(-1, 2);
    expect(curve[curve.length - 1]).toBeCloseTo(1, 2);
    expect(curve[2048]).toBeCloseTo(0, 2);
  });

  it("is strictly non-decreasing (monotonic soft knee)", () => {
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
    }
  });

  it("never exceeds ±1 — brickwall", () => {
    for (const v of curve) {
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
  });

  it("passes low levels through nearly linearly", () => {
    // x ≈ 0.25 → tanh(0.3)/tanh(1.2) ≈ 0.349
    expect(curve[2560]).toBeGreaterThan(0.33);
    expect(curve[2560]).toBeLessThan(0.37);
  });
});

describe("dbToGain", () => {
  it("converts dBFS ceiling correctly", () => {
    expect(dbToGain(-1.5)).toBeCloseTo(10 ** (-1.5 / 20));
    expect(dbToGain(0)).toBe(1);
  });
});
