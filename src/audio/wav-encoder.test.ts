import { describe, expect, it } from "vitest";
import { encodeWav } from "./wav-encoder";

async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function str(b: Uint8Array, off: number, len: number): string {
  return String.fromCharCode(...b.slice(off, off + len));
}

describe("encodeWav", () => {
  it("writes a valid RIFF/WAVE 24-bit PCM header", async () => {
    const samples = new Float32Array(4).fill(0);
    const blob = encodeWav([samples], 48000);
    const b = await bytes(blob);

    expect(str(b, 0, 4)).toBe("RIFF");
    // file size - 8
    const riffSize = b[4] | (b[5] << 8) | (b[6] << 16) | (b[7] << 24);
    expect(riffSize).toBe(36 + 4 * 3);
    expect(str(b, 8, 4)).toBe("WAVE");
    expect(str(b, 12, 4)).toBe("fmt ");
    // PCM format = 1
    expect(b[20] | (b[21] << 8)).toBe(1);
    // channels
    expect(b[22] | (b[23] << 8)).toBe(1);
    // sample rate
    const rate = b[24] | (b[25] << 8) | (b[26] << 16) | (b[27] << 24);
    expect(rate).toBe(48000);
    // byte rate = rate * blockAlign = 48000 * 3
    const byteRate = b[28] | (b[29] << 8) | (b[30] << 16) | (b[31] << 24);
    expect(byteRate).toBe(48000 * 3);
    // block align = channels * 3
    expect(b[32] | (b[33] << 8)).toBe(3);
    // bits per sample
    expect(b[34] | (b[35] << 8)).toBe(24);
    expect(str(b, 36, 4)).toBe("data");
    // data chunk length
    const dataLen = b[40] | (b[41] << 8) | (b[42] << 16) | (b[43] << 24);
    expect(dataLen).toBe(12); // 4 frames * 3 bytes
  });

  it("encodes known sample values little-endian 24-bit", async () => {
    // +0.5 → 0.5 * 0x7FFFFF ≈ 0x3FFFFF (4194303.5 → round)
    const blob = encodeWav([Float32Array.of(0.5)], 44100);
    const b = await bytes(blob);
    const v =
      b[44] | (b[45] << 8) | (b[46] << 16) | 0; // low 3 bytes; sign via 32-bit
    const signed = v > 0x7fffff ? v - 0x1000000 : v;
    expect(signed).toBeCloseTo(Math.round(0.5 * 0x7fffff), -1);

    // negative half — sign bit lives in the top byte of the 3-byte sample
    const blob2 = encodeWav([Float32Array.of(-0.5)], 44100);
    const b2 = await bytes(blob2);
    expect(b2[46] & 0x80).not.toBe(0);
  });

  it("clamps out-of-range samples to full scale", async () => {
    const blob = encodeWav([Float32Array.of(2.0, -2.0)], 48000);
    const b = await bytes(blob);
    // +full scale = 0x7FFFFF
    expect(b[44]).toBe(0xff);
    expect(b[45]).toBe(0xff);
    expect(b[46]).toBe(0x7f);
    // −full scale = −0x7FFFFF (symmetric scaling)
    expect(b[47]).toBe(0x01);
    expect(b[48]).toBe(0x00);
    expect(b[49]).toBe(0x80);
  });

  it("interleaves stereo channels", async () => {
    const l = Float32Array.of(1, 0);
    const r = Float32Array.of(0, 1);
    const blob = encodeWav([l, r], 48000);
    const b = await bytes(blob);
    expect(b[22] | (b[23] << 8)).toBe(2); // stereo
    const dataLen = b[40] | (b[41] << 8) | (b[42] << 16) | (b[43] << 24);
    expect(dataLen).toBe(2 * 2 * 3);
    // frame 0 left = full scale positive
    expect(b[46]).toBe(0x7f);
    // frame 0 right = 0
    expect(b[47] | (b[48] << 8) | (b[49] << 16)).toBe(0);
  });
});
