/**
 * Canvas-based real-time visualizers driven by requestAnimationFrame.
 * Each takes a data supplier (from the engine's analyser) so they stay
 * decoupled from Web Audio internals.
 */

export type SpectrumSupplier = (target: Uint8Array) => boolean;
export type WaveformSupplier = (target: Uint8Array) => boolean;

function fitCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return null;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Intensity colour ramp: deep blue → teal → green → yellow → white. */
function heat(v: number): string {
  // v in 0..1
  const stops: [number, [number, number, number]][] = [
    [0, [8, 12, 30]],
    [0.35, [16, 70, 120]],
    [0.6, [22, 160, 140]],
    [0.8, [180, 210, 60]],
    [1, [255, 255, 240]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = (v - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
      return `rgb(${r},${g},${b})`;
    }
  }
  return "rgb(255,255,240)";
}

export class Spectrogram {
  private buf: Uint8Array;
  private raf = 0;
  private stopped = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private getSpectrum: SpectrumSupplier,
    fftSize: number,
  ) {
    this.buf = new Uint8Array(fftSize / 2);
    this.draw();
  }

  stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
  }

  /** Log-frequency mapping: bin index for a normalized position 0..1. */
  private static binFor(pos: number, bins: number): number {
    // 40 Hz .. 18 kHz perceptual spread
    const minLog = Math.log10(40);
    const maxLog = Math.log10(18000);
    const freq = 10 ** (minLog + pos * (maxLog - minLog));
    return Math.min(bins - 1, Math.round((freq / 48000) * 2 * bins));
  }

  private draw = (): void => {
    if (this.stopped) return;
    this.raf = requestAnimationFrame(this.draw);
    const ctx = fitCanvas(this.canvas);
    if (!ctx) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    const ok = this.getSpectrum(this.buf);
    if (!ok) return;

    // Scroll left by 2px and paint the newest column on the right.
    ctx.drawImage(this.canvas, -2, 0, w, h);

    const bins = this.buf.length;
    for (let y = 0; y < h; y++) {
      const pos = 1 - y / h; // top = high frequency
      const bin = Spectrogram.binFor(pos, bins);
      const v = this.buf[bin] / 255;
      ctx.fillStyle = heat(v);
      ctx.fillRect(w - 2, y, 2, 1);
    }
  };
}

export class Oscilloscope {
  private buf: Uint8Array;
  private raf = 0;
  private stopped = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private getWaveform: WaveformSupplier,
    fftSize: number,
  ) {
    this.buf = new Uint8Array(fftSize);
    this.draw();
  }

  stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
  }

  private draw = (): void => {
    if (this.stopped) return;
    this.raf = requestAnimationFrame(this.draw);
    const ctx = fitCanvas(this.canvas);
    if (!ctx) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#27272a";
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if (!this.getWaveform(this.buf)) return;

    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const step = this.buf.length / w;
    for (let x = 0; x < w; x++) {
      const v = (this.buf[Math.floor(x * step)] - 128) / 128;
      const y = h / 2 + v * (h / 2 - 2);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
}

export class VuMeter {
  private buf = new Uint8Array(2048);
  private raf = 0;
  private stopped = false;
  private peakHold = 0;
  private lastPeakTime = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private getWaveform: WaveformSupplier,
    _analyserFftSize: number,
  ) {
    this.buf = new Uint8Array(_analyserFftSize);
    this.draw();
  }

  stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
  }

  private draw = (): void => {
    if (this.stopped) return;
    this.raf = requestAnimationFrame(this.draw);
    const ctx = fitCanvas(this.canvas);
    if (!ctx) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    let peak = 0;
    if (this.getWaveform(this.buf)) {
      for (let i = 0; i < this.buf.length; i++) {
        const v = Math.abs(this.buf[i] - 128) / 128;
        if (v > peak) peak = v;
      }
    }

    const now = performance.now();
    if (peak >= this.peakHold || now - this.lastPeakTime > 900) {
      this.peakHold = peak;
      this.lastPeakTime = now;
    } else {
      this.peakHold *= 0.985; // slow release
    }

    ctx.clearRect(0, 0, w, h);
    const dbfs = 20 * Math.log10(Math.max(peak, 1e-4));
    const norm = Math.max(0, Math.min(1, (dbfs + 60) / 60)); // −60..0 dB

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#22d3ee");
    grad.addColorStop(0.75, "#34d399");
    grad.addColorStop(0.92, "#fbbf24");
    grad.addColorStop(1, "#ef4444");

    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w * norm, h);

    // peak-hold marker
    const pNorm = Math.max(0, Math.min(
      1,
      (20 * Math.log10(Math.max(this.peakHold, 1e-4)) + 60) / 60,
    ));
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(Math.max(0, w * pNorm - 1), 0, 2, h);
  };
}
