import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  AudioLines,
  Circle,
  Mic,
  ShieldCheck,
  Square,
  Waves,
} from "lucide-react";
import {
  AudioEngine,
  type EngineState,
} from "./audio/engine";
import { DENOISER_ENGINES } from "./audio/denoiser";
import {
  DEFAULT_PRESET_ID,
  PRESETS,
  type DspParams,
  type PresetId,
} from "./audio/presets";
import { makeT, type Lang } from "./i18n";
import { Panel, Toggle } from "./ui/primitives";
import { PresetGrid } from "./ui/PresetGrid";
import { EqPanel } from "./ui/EqPanel";
import { VisualizerStack } from "./ui/VisualizerStack";

type DeviceInfo = { deviceId: string; label: string };

export default function App() {
  const [lang, setLang] = useState<Lang>("th");
  const t = useMemo(() => makeT(lang), [lang]);

  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new AudioEngine({ ...PRESETS[DEFAULT_PRESET_ID].dsp });
  }
  const engine = engineRef.current;

  const [state, setState] = useState<EngineState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<DeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<DeviceInfo[]>([]);
  const [inputId, setInputId] = useState<string>("");
  const [outputId, setOutputId] = useState<string>("");
  const [monitorOn, setMonitorOn] = useState(false);
  const [bypassOn, setBypassOn] = useState(false);
  const [presetId, setPresetId] = useState<PresetId>(DEFAULT_PRESET_ID);
  const [params, setParams] = useState<DspParams>({
    ...PRESETS[DEFAULT_PRESET_ID].dsp,
  });
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState(0);
  const [sampleRate, setSampleRate] = useState(0);
  const [vad, setVad] = useState(0);

  // Engine state + VAD telemetry ------------------------------------------------
  useEffect(() => {
    const off = engine.subscribe(({ state: s, error: e }) => {
      setState(s);
      if (e) setError(e.message);
    });
    return () => {
      off();
    };
  }, [engine]);

  useEffect(() => {
    if (state !== "running") return;
    const off = engine.subscribeDenoiserTelemetry?.((msg) => {
      if (msg.type === "vad" && typeof msg.vad === "number") setVad(msg.vad);
    });
    const id = setInterval(() => {
      setLatencyMs(engine.getLatencyMs());
      setSampleRate(engine.getSampleRate());
    }, 500);
    return () => {
      off?.();
      clearInterval(id);
    };
  }, [state, engine]);

  // Devices ---------------------------------------------------------------------
  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setInputs(
        list
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Input ${d.deviceId.slice(0, 5)}` })),
      );
      setOutputs(
        list
          .filter((d) => d.kind === "audiooutput")
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Output ${d.deviceId.slice(0, 5)}` })),
      );
    } catch {
      /* device enumeration can fail pre-permission; ignore */
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () =>
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
  }, [refreshDevices]);

  // Actions ---------------------------------------------------------------------
  const startMic = async () => {
    setError(null);
    try {
      await engine.start(inputId || undefined);
      await refreshDevices();
      setSampleRate(engine.getSampleRate());
      setLatencyMs(engine.getLatencyMs());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const stopMic = async () => {
    stopRecording();
    await engine.stop();
    setRecordedUrl(null);
  };

  const applyPreset = (id: PresetId) => {
    setPresetId(id);
    const p = { ...PRESETS[id].dsp };
    setParams(p);
    engine.setPreset(p);
  };

  const patchParams = (patch: Partial<DspParams>) => {
    setParams((prev) => ({ ...prev, ...patch }));
    engine.updateParams(patch);
  };

  const startRecording = () => {
    setRecordedUrl(null);
    engine.startRecording();
    setRecording(true);
  };

  const stopRecording = () => {
    if (!recording) return;
    const blob = engine.stopRecording();
    setRecording(false);
    if (blob) {
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
    }
  };

  const running = state === "running";

  // Render -----------------------------------------------------------------------
  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-4 px-4 py-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/mic.svg" alt="" className="h-10 w-10" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">{t("appName")}</h1>
            <p className="text-xs text-zinc-500">{t("tagline")}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLang(lang === "th" ? "en" : "th")}
          className="rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:border-zinc-700"
        >
          {lang === "th" ? "EN" : "ไทย"}
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}

      <main className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        {/* Left column: visualizers + custom EQ */}
        <div className="flex flex-col gap-4">
          <Panel title="Signal" icon={<Activity size={13} />}>
            {running ? (
              <VisualizerStack engine={engine} t={t} />
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-800 text-zinc-600">
                <Waves size={28} strokeWidth={1.5} />
                <p className="max-w-xs text-center text-sm">
                  {state === "starting"
                    ? "…"
                    : lang === "th"
                      ? "กด “เริ่มไมโครโฟน” เพื่อเริ่มประมวลผลสด"
                      : "Press “Start Microphone” to begin live processing"}
                </p>
              </div>
            )}
          </Panel>

          <Panel title={t("customEq")} icon={<AudioLines size={13} />}>
            <EqPanel
              params={params}
              onPatch={(p) => {
                if (presetId !== "custom") {
                  setPresetId("custom");
                  const base = { ...PRESETS.custom.dsp };
                  setParams(base);
                  engine.setPreset(base);
                }
                patchParams(p);
              }}
              disabled={presetId !== "custom"}
              t={t}
            />
            {presetId !== "custom" && (
              <p className="mt-3 text-[11px] text-zinc-600">
                {lang === "th"
                  ? "เลือกโปรไฟล์ Custom เพื่อปรับค่าได้"
                  : "Switch to the Custom profile to edit values"}
              </p>
            )}
          </Panel>
        </div>

        {/* Right column: transport + presets + status */}
        <div className="flex flex-col gap-4">
          <Panel>
            {/* Devices */}
            <div className="mb-3 grid grid-cols-1 gap-2">
              <label className="block text-xs text-zinc-400">
                {t("inputDevice")}
                <select
                  value={inputId}
                  onChange={(e) => setInputId(e.target.value)}
                  disabled={running}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200 disabled:opacity-50"
                >
                  <option value="">Default</option>
                  {inputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-zinc-400">
                {t("outputDevice")}
                <select
                  value={outputId}
                  onChange={(e) => {
                    setOutputId(e.target.value);
                    if (running) void engine.selectOutput(e.target.value);
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200"
                >
                  <option value="">System default</option>
                  {outputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Transport */}
            <div className="flex flex-wrap gap-2">
              {!running ? (
                <button
                  type="button"
                  onClick={startMic}
                  disabled={state === "starting"}
                  className="flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-[0_0_20px_rgba(52,211,153,0.35)] transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  <Mic size={15} /> {t("startMic")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopMic}
                  className="flex items-center gap-2 rounded-full bg-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-600"
                >
                  <Square size={14} /> {t("stopMic")}
                </button>
              )}

              {!recording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={!running}
                  className="flex items-center gap-2 rounded-full border border-red-900/70 bg-red-950/40 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Circle size={12} fill="currentColor" /> {t("record")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex animate-pulse items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  <Square size={12} fill="currentColor" /> {t("stopRecord")}
                </button>
              )}
            </div>

            {recording && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                {t("recordingHint")}
              </p>
            )}

            {recordedUrl && !recording && (
              <a
                href={recordedUrl}
                download={`voiceclear-${Date.now()}.wav`}
                className="mt-2 flex w-fit items-center gap-2 rounded-full border border-emerald-800 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-950/80"
              >
                <ArrowDownToLine size={13} /> {t("exportWav")} ·{" "}
                {(sampleRate / 1000).toFixed(1)} kHz / 24-bit
              </a>
            )}

            {/* Toggles */}
            <div className="mt-3 flex flex-wrap gap-2">
              <Toggle
                label={t("monitor")}
                on={monitorOn}
                onChange={(on) => {
                  setMonitorOn(on);
                  void engine.setMonitor(on, outputId || undefined);
                }}
                disabled={!running}
              />
              <Toggle
                label={t("bypass")}
                on={bypassOn}
                accent="amber"
                onChange={(on) => {
                  setBypassOn(on);
                  engine.setBypass(on);
                }}
                disabled={!running}
              />
            </div>
          </Panel>

          <Panel title={t("presets")}>
            <PresetGrid active={presetId} onSelect={applyPreset} lang={lang} />
            <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-800/70 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
              <span>{t("engine")}</span>
              <select
                value="rnnoise"
                disabled // phase 2: DeepFilterNet option lands here
                onChange={() => undefined}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-200"
              >
                {DENOISER_ENGINES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {lang === "th" ? d.nameTh : d.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </Panel>

          <Panel title="Status">
            <dl className="grid grid-cols-3 gap-2 text-center">
              <Stat label={t("latency")} value={running ? `${latencyMs}` : "—"} unit="ms" good={running && latencyMs <= 20} />
              <Stat label={t("sampleRate")} value={sampleRate ? (sampleRate / 1000).toFixed(1) : "—"} unit="kHz" good />
              <Stat label="VAD" value={`${Math.round(vad * 100)}`} unit="%" good />
            </dl>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-zinc-600">
              <ShieldCheck size={13} className="mt-px shrink-0 text-emerald-700" />
              {t("privacyNote")}
            </p>
          </Panel>
        </div>
      </main>

      <footer className="pb-4 text-center text-[11px] text-zinc-700">
        VoiceClear Studio — client-side AI voice DSP · RNNoise WASM · Web Audio
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  good,
}: {
  label: string;
  value: string;
  unit: string;
  good: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/60 py-2">
      <dt className="text-[10px] tracking-wider text-zinc-500 uppercase">{label}</dt>
      <dd className={`font-mono text-lg ${good ? "text-emerald-300" : "text-zinc-400"}`}>
        {value}
        <span className="ml-0.5 text-[10px] text-zinc-600">{unit}</span>
      </dd>
    </div>
  );
}
