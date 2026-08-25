import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  Circle,
  Mic,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Waves,
} from "lucide-react";
import { AudioEngine, type EngineState } from "./audio/engine";
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
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Input ${d.deviceId.slice(0, 5)}`,
          })),
      );
      setOutputs(
        list
          .filter((d) => d.kind === "audiooutput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Output ${d.deviceId.slice(0, 5)}`,
          })),
      );
    } catch {
      /* device enumeration can fail pre-permission; ignore */
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () =>
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        refreshDevices,
      );
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
    if (blob) setRecordedUrl(URL.createObjectURL(blob));
  };

  const running = state === "running";

  // Render -----------------------------------------------------------------------
  return (
    <div style={{ minHeight: "100%" }}>
      {/* ── Frosted glass header ── */}
      <header className="glass-header">
        <div className="brand">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
            <rect width="32" height="32" rx="8" fill="var(--accent)" />
            <g stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
              <line x1="7" y1="13" x2="7" y2="19" />
              <line x1="12" y1="9" x2="12" y2="23" />
              <line x1="16" y1="6" x2="16" y2="26" />
              <line x1="20" y1="10" x2="20" y2="22" />
              <line x1="25" y1="14" x2="25" y2="18" />
            </g>
          </svg>
          <span className="brand-name">
            VoiceClear
            <span className="brand-dot">.</span>Studio
          </span>
          <span className="brand-divider" />
          <span className="brand-section">AI Voice DSP</span>
        </div>

        <div className="seg" role="group" aria-label="Language">
          <button
            type="button"
            className={`seg-btn ${lang === "th" ? "active" : ""}`}
            onClick={() => setLang("th")}
          >
            ไทย
          </button>
          <button
            type="button"
            className={`seg-btn ${lang === "en" ? "active" : ""}`}
            onClick={() => setLang("en")}
          >
            EN
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="hero">
        <span className="mono">
          Web-Based AI Voice Denoising · 100% On-Device DSP
        </span>
        <h1>{t("tagline").split("—")[0]}</h1>
        <p>
          {lang === "th"
            ? "ตัดเสียงรบกวนด้วย AI + เก็บละเอียดแบบ Studio — AEC, Denoise, EQ 5 Band, Compressor, Limiter ในเบราว์เซอร์ของคุณ"
            : "AI noise suppression + studio mastering in your browser — AEC, denoise, 5-band EQ, compressor, limiter."}
        </p>
        <p className="privacy">
          <span className="mono" style={{ color: "var(--live)" }}>
            <ShieldCheck size={11} style={{ verticalAlign: "-1px" }} />{" "}
            {t("privacyNote")}
          </span>
        </p>
      </section>

      {error && (
        <div className="app-main" style={{ paddingTop: 0 }}>
          <div role="alert" className="alert">
            {error}
          </div>
        </div>
      )}

      {/* ── Main workspace ── */}
      <main className="app-main workspace-grid">
        <div className="workspace-signal">
          <Panel className="h-full" title="Signal" icon={<Activity size={13} />}>
            {running ? (
              <VisualizerStack engine={engine} t={t} />
            ) : (
              <div
                className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-[var(--faint)]"
                style={{ borderColor: "var(--border-strong)" }}
              >
                <Waves size={26} strokeWidth={1.5} />
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
        </div>

        <div className="workspace-controls">
          <Panel className="h-full">
            <div className="mb-6 grid grid-cols-1 gap-4">
              <label className="block">
                <span className="f-label">{t("inputDevice")}</span>
                <select
                  value={inputId}
                  onChange={(e) => setInputId(e.target.value)}
                  disabled={running}
                  className="io-select"
                >
                  <option value="">Default</option>
                  {inputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="f-label">{t("outputDevice")}</span>
                <select
                  value={outputId}
                  onChange={(e) => {
                    setOutputId(e.target.value);
                    if (running) void engine.selectOutput(e.target.value);
                  }}
                  className="io-select"
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

            <div className="flex flex-wrap items-center gap-3">
              {!running ? (
                <button
                  type="button"
                  onClick={startMic}
                  disabled={state === "starting"}
                  className="btn btn-accent"
                >
                  <Mic size={15} /> {t("startMic")}
                </button>
              ) : (
                <button type="button" onClick={stopMic} className="btn">
                  <Square size={13} /> {t("stopMic")}
                </button>
              )}

              {!recording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={!running}
                  className="btn btn-danger"
                >
                  <Circle size={11} fill="currentColor" /> {t("record")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="btn btn-danger"
                >
                  <Square size={11} fill="currentColor" /> {t("stopRecord")}
                </button>
              )}
            </div>

            {recording && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--danger)]">
                <span
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ background: "var(--danger)" }}
                />
                {t("recordingHint")}
              </p>
            )}

            {recordedUrl && !recording && (
              <a
                href={recordedUrl}
                download={`voiceclear-${Date.now()}.wav`}
                className="export-pill mt-4"
              >
                <ArrowDownToLine size={13} /> {t("exportWav")} ·{" "}
                {(sampleRate / 1000).toFixed(1)} kHz / 24-bit
              </a>
            )}

            <div className="mt-6 flex flex-col gap-4">
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
                onChange={(on) => {
                  setBypassOn(on);
                  engine.setBypass(on);
                }}
                disabled={!running}
              />
            </div>
          </Panel>
        </div>

        <div className="workspace-eq">
          <Panel
            className="h-full"
            title={`${t("customEq")} · Sliders`}
            icon={<SlidersHorizontal size={13} />}
          >
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
              <p className="custom-lock-note">
                {lang === "th"
                  ? "เลือกโปรไฟล์ Custom เพื่อปลดล็อกการปรับแต่ง"
                  : "Choose the Custom profile to unlock these controls"}
              </p>
            )}
          </Panel>
        </div>

        <div className="workspace-presets">
          <Panel className="h-full" title={t("presets")}>
            <PresetGrid active={presetId} onSelect={applyPreset} lang={lang} />
            <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] px-4 py-3">
              <span className="f-label" style={{ marginBottom: 0 }}>
                {t("engine")}
              </span>
              <select
                value="rnnoise"
                disabled
                onChange={() => undefined}
                className="io-select"
                style={{ width: "auto" }}
              >
                {DENOISER_ENGINES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {lang === "th" ? d.nameTh : d.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </Panel>
        </div>

        <div className="workspace-status">
          <Panel title="Status">
            <dl className="status-grid">
              <Stat
                label={t("latency")}
                value={running ? `${latencyMs}` : "—"}
                unit="ms"
                good={running && latencyMs <= 20}
              />
              <Stat
                label={t("sampleRate")}
                value={sampleRate ? (sampleRate / 1000).toFixed(1) : "—"}
                unit="kHz"
                good
              />
              <Stat
                label="VAD"
                value={`${Math.round(vad * 100)}`}
                unit="%"
                good
              />
            </dl>
          </Panel>
        </div>
      </main>

      <footer className="app-footer">
        VoiceClear Studio —
        {lang === "th"
          ? " AI ตัดเสียงฝั่งไคลเอนต์ · RNNoise WASM · Web Audio API"
          : " Client-side AI voice DSP · RNNoise WASM · Web Audio API"}
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
    <div className="stat-card">
      <dt className="mono">{label}</dt>
      <dd className={`stat-num ${good ? "good" : ""}`}>
        {value}
        <span className="stat-unit">{unit}</span>
      </dd>
    </div>
  );
}