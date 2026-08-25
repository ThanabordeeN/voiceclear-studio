import { useEffect, useRef } from "react";
import type { AudioEngine } from "../audio/engine";
import { Oscilloscope, Spectrogram, VuMeter } from "../viz/visualizers";
import type { T } from "../i18n";

const FFT_SIZE = 2048;

/** Live visualizer stack: spectrogram + oscilloscope + peak VU meter. */
export function VisualizerStack({
  engine,
  t,
}: {
  engine: AudioEngine;
  t: T;
}) {
  const specRef = useRef<HTMLCanvasElement>(null);
  const scopeRef = useRef<HTMLCanvasElement>(null);
  const vuRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!specRef.current || !scopeRef.current || !vuRef.current) return;
    const spec = new Spectrogram(
      specRef.current,
      (b) => engine.getSpectrum(b),
      FFT_SIZE,
    );
    const scope = new Oscilloscope(
      scopeRef.current,
      (b) => engine.getWaveform(b),
      FFT_SIZE,
    );
    const vu = new VuMeter(
      vuRef.current,
      (b) => engine.getWaveform(b),
      FFT_SIZE,
    );
    return () => {
      spec.stop();
      scope.stop();
      vu.stop();
    };
  }, [engine]);

  return (
    <div className="flex flex-col gap-3">
      <figure>
        <figcaption className="mb-1 text-[11px] tracking-wider text-zinc-500 uppercase">
          {t("spectrogram")}
        </figcaption>
        <canvas
          ref={specRef}
          className="h-36 w-full rounded-lg border border-zinc-800/80 bg-[#0a0a0f]"
        />
      </figure>
      <figure>
        <figcaption className="mb-1 text-[11px] tracking-wider text-zinc-500 uppercase">
          {t("waveform")}
        </figcaption>
        <canvas
          ref={scopeRef}
          className="h-20 w-full rounded-lg border border-zinc-800/80 bg-[#0a0a0f]"
        />
      </figure>
      <figure>
        <figcaption className="mb-1 flex justify-between text-[11px] tracking-wider text-zinc-500 uppercase">
          <span>{t("outputLevel")}</span>
          <span className="font-mono">-60 dB … 0 dBFS</span>
        </figcaption>
        <canvas
          ref={vuRef}
          className="h-3 w-full rounded-full border border-zinc-800/80 bg-zinc-950"
        />
      </figure>
    </div>
  );
}
