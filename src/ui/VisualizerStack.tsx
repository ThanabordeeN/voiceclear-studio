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
    <div className="flex flex-col gap-5">
      <figure>
        <figcaption className="viz-label">
          <span>{t("spectrogram")}</span>
        </figcaption>
        <canvas
          ref={specRef}
          className="viz-frame h-36 w-full"
        />
      </figure>
      <figure>
        <figcaption className="viz-label">
          <span>{t("waveform")}</span>
        </figcaption>
        <canvas
          ref={scopeRef}
          className="viz-frame h-20 w-full"
        />
      </figure>
      <figure>
        <figcaption className="viz-label">
          <span>{t("outputLevel")}</span>
          <span className="font-normal tracking-normal normal-case">
            -60 dB … 0 dBFS
          </span>
        </figcaption>
        <canvas
          ref={vuRef}
          className="viz-frame h-3 w-full"
        />
      </figure>
    </div>
  );
}