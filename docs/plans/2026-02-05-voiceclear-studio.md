# VoiceClear Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build VoiceClear Studio — a client-side real-time AI voice denoising + DSP mastering web app (Live Mic mode v1).

**Architecture:** SPA on Vite+React+TS. An `AudioEngine` class owns the Web Audio graph: mic → RNNoise AudioWorklet → EQ/compressor/limiter chain → monitor/recorder/analysers. Denoiser is an interface so DeepFilterNet can be added later. All processing stays client-side.

**Tech Stack:** Vite, React, TypeScript, TailwindCSS v4, lucide-react, RNNoise WASM (prebuilt npm), Vitest, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-02-05-voiceclear-studio-design.md`

## Global Constraints

- DSP parameter values are EXACT per spec §4: HP 55 Hz Q0.707 · lowshelf 130 Hz +3.8 dB · peaking 220 Hz Q0.85 +3.2 dB · peaking 500 Hz Q1.40 −2.0 dB · peaking 4500 Hz Q1.20 −1.8 dB · compressor −16 dB / 2.5:1 / attack 15 ms / release 100 ms · ceiling −1.5 dBFS
- Worklet frame: 480 samples @48 kHz (render quantum may be 128; worklet accumulates into 480-sample frames)
- getUserMedia constraints: `echoCancellation: true, autoGainControl: false, noiseSuppression: false`
- No audio data ever sent over network
- UI language: Thai primary, English toggle
- Node/bun tooling via bun; deploy target Cloudflare Pages

---

### Task 1: Scaffold project + tooling

**Files:** Create `voiceclear-studio/` (package.json, vite.config.ts, tsconfig.json, index.html, tailwind via @tailwindcss/vite, src/main.tsx, src/App.tsx stub), vitest config, `.gitignore`, git init.

- [x] Scaffold Vite React-TS app with bun (`bun create vite` or manual files), add tailwindcss + @tailwindcss/vite + lucide-react + vitest
- [x] `bun install && bun run build` passes; commit

### Task 2: Presets data model (TDD)

**Files:** Create `src/audio/presets.ts`; Test `src/audio/presets.test.ts`.

**Produces:** `type DspParams { hpFreq, hpQ, lowshelfFreq, lowshelfGain, bodyFreq, bodyQ, bodyGain, mudFreq, mudQ, mudGain, harshFreq, harshQ, harshGain, compThreshold, compRatio, compAttack, compRelease, limiterCeiling, denoiseStrength }`, `PRESETS: Record<PresetId, Preset>` where `PresetId = 'warm' | 'broadcast' | 'natural' | 'custom'`. Default = warm ("Krisp Studio Warm").

- [x] Failing test: warm preset matches exact spec §4 values; broadcast has hpFreq=60 and stronger mud cut; natural has flat EQ gains (±0); custom defaults equal warm
- [x] Implement presets; tests pass; commit

### Task 3: WAV encoder (TDD)

**Files:** Create `src/audio/wav-encoder.ts`; Test `src/audio/wav-encoder.test.ts`.

**Produces:** `encodeWav(channels: Float32Array[], sampleRate: number): Blob` — RIFF/WAVE, 24-bit PCM little-endian interleaved, correct header sizes.

- [x] Failing test: header bytes "RIFF"/"WAVE"/"fmt "/"data", byteRate = rate*3*ch, blockAlign=3*ch, data chunk length = samples*3*ch, sample value round-trip for known values (e.g. 0 dBFS→0x7FFFFF clamp)
- [x] Implement encoder; tests pass; commit

### Task 4: RNNoise WASM integration + AudioWorklet processor

**Files:** Create `public/worklets/noise-suppressor.processor.js`, `src/audio/denoiser.ts`, `src/audio/worklet-client.ts`.

- [x] Research/install prebuilt RNNoise WASM package (try `rnnoise-wasm` variants on npm; fallback: vendor prebuilt wasm+glue). Expose via `Denoiser` interface `{ init(ctx), process(frame: Float32Array): Float32Array, setStrength(v), dispose() }`
- [x] Worklet processor: accumulate 128-sample quanta → 480-sample frames → denoise → output; posts meter messages (VAD level, noise level)
- [x] Build passes; commit (browser smoke-test deferred to Task 7)

### Task 5: DSP graph builder

**Files:** Create `src/dsp/graph.ts`.

**Produces:** `buildChain(ctx: BaseAudioContext, params: DspParams): { input, output, nodes }` — creates HP→lowshelf→peaking×3→compressor→waveshaper(tanh curve)→ceiling gain exactly per spec. `applyParams(nodes, params)` updates all values.

- [x] Unit-test tanh curve shape (clamps near ±1, monotonic) where testable without AudioContext; param application tested via stubbed nodes
- [x] Commit

### Task 6: AudioEngine orchestration

**Files:** Create `src/audio/engine.ts`.

**Produces:** class `AudioEngine` with methods `start(inputDeviceId?)`, `stop()`, `setPreset(id)`, `setBypass(bool)`, `setMonitor(bool, outputDeviceId?)`, `startRecording()/stopRecording(): Promise<Blob>`, getters for analyser data, event emitter for state changes. Bypass = raw source direct to outputs. Recording taps processed PCM frames into buffer → encodeWav on stop.

- [x] Typecheck passes; commit

### Task 7: Visualizers (Canvas)

**Files:** Create `src/viz/Spectrogram.ts`, `src/viz/Oscilloscope.ts`, `src/viz/VuMeter.ts` — rAF-driven classes taking AnalyserNode + canvas.

- [x] Each draws correctly (manual browser verification); commit

### Task 8: UI — main studio interface

**Files:** Create `src/App.tsx`, `src/ui/*` (TopBar, DeviceBar, PresetSelector, TransportControls, CustomEqPanel, VisualizerStack, StatusStrip), `src/i18n/index.ts` (TH/EN dict + toggle).

- [x] Full layout: dark studio theme; device selectors; monitor & bypass toggles; record/export buttons; preset cards; custom sliders (disabled unless custom); visualizer stack; latency/status readout
- [x] i18n TH default, EN toggle; build passes; commit

### Task 9: Integration polish + deploy config

**Files:** Modify as needed; Create `wrangler.toml`, `public/_headers` (COEP/COOP not required for plain worklets — verify), README.md.

- [x] Manual end-to-end browser test: mic → hear processed audio, bypass A/B audible difference, recording exports valid WAV (verify with ffprobe), latency readout ≤20 ms claim sanity-checked
- [x] `bun run build && npx wrangler pages deploy` config ready; README with run instructions; commit

### Task 10 (Phase 2 backlog, not now): Offline file mode + DeepFilterNet engine option

Deferred per user decision (v1.1).
