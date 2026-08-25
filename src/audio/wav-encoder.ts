/**
 * Minimal RIFF/WAVE encoder — Float32 PCM in, 24-bit WAV out.
 * Used for high-quality export of recorded/processed audio.
 */

function clamp(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

export function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
): Blob {
  const numCh = channels.length;
  const numFrames = numCh > 0 ? channels[0].length : 0;
  const bytesPerSample = 3;
  const blockAlign = numCh * bytesPerSample;
  const dataLen = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buffer);

  // RIFF header
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  writeAscii(view, 8, "WAVE");

  // fmt chunk
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 24, true);

  // data chunk
  writeAscii(view, 36, "data");
  view.setUint32(40, dataLen, true);

  let off = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = clamp(channels[ch][i]);
      let int = Math.round(s * 0x7fffff);
      if (int > 0x7fffff) int = 0x7fffff;
      if (int < -0x800000) int = -0x800000;
      view.setUint8(off, int & 0xff);
      view.setUint8(off + 1, (int >> 8) & 0xff);
      view.setUint8(off + 2, (int >> 16) & 0xff);
      off += 3;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
