# VoiceClear Studio — Design Spec

**Date:** 2026-02-05
**Type:** Web-Based AI Voice Denoising & DSP Platform (Client-Side Real-Time)
**Location:** `web-apps/voiceclear-studio/`
**Deployment:** Cloudflare Pages (static, zero server cost)

## 1. Overview

Real-time speech processing in the browser with 3 missions:

1. **Acoustic Echo Cancellation (AEC)** — browser-native via `getUserMedia` constraints
2. **AI Noise Suppression** — RNNoise WASM inside an AudioWorklet (v1); DeepFilterNet selectable in UI (phase 2)
3. **Studio DSP Mastering Chain** — HP filter → 5-band EQ → compressor → brickwall soft-clip limiter

All audio stays in-memory on the user's machine. No network transmission of audio.

## 2. Tech Stack

- Vite + React + TypeScript (SPA, no SSR needed)
- TailwindCSS, lucide-react icons
- Web Audio API: AudioContext, AudioWorkletNode, BiquadFilterNode, DynamicsCompressorNode, WaveShaperNode
- AI Denoise: prebuilt RNNoise WASM npm package (behind a `Denoiser` interface; DeepFilterNet WASM added later as selectable engine)
- Visualizers: Canvas API (spectrogram, oscilloscope, VU meter)
- Export: custom PCM→WAV encoder (24-bit), MP3 optional later
- i18n: Thai primary + English toggle

## 3. Project Layout

```
voiceclear-studio/
├── public/worklets/noise-suppressor.processor.js   # AudioWorklet processor (loads RNNoise WASM)
├── src/
│   ├── audio/
│   │   ├── engine.ts          # AudioEngine — owns AudioContext + graph lifecycle
│   │   ├── denoiser.ts        # Denoiser interface (swap engines)
│   │   ├── presets.ts         # 4 preset data objects
│   │   └── wav-encoder.ts     # Float32 PCM → 24-bit WAV blob
│   ├── dsp/graph.ts           # builds node chain per spec §4
│   ├── viz/                   # Spectrogram / Oscilloscope / VU meter canvases
│   ├── ui/                    # React components (Tailwind)
│   └── i18n/                  # TH/EN strings
└── wrangler.toml              # Cloudflare Pages deploy
```

## 4. Signal Chain (per spec §4)

```
getUserMedia({ echoCancellation: true, autoGainControl: false, noiseSuppression: false })
  → MediaStreamAudioSourceNode
  → AudioWorkletNode [RNNoise; frame 480 samples @48kHz; VAD sensitivity 0.85]
  → Biquad highpass      55 Hz, Q 0.707
  → Biquad lowshelf     130 Hz, +3.8 dB
  → Biquad peaking      220 Hz, Q 0.85, +3.2 dB
  → Biquad peaking      500 Hz, Q 1.40, −2.0 dB
  → Biquad peaking     4500 Hz, Q 1.20, −1.8 dB
  → DynamicsCompressor  −16 dB, 2.5:1, attack 15 ms, release 100 ms
  → WaveShaperNode (tanh soft clip) + GainNode ceiling −1.5 dBFS
```

Outputs:
- MonitorGain → destination (`setSinkId` for output device selection)
- MediaStreamAudioDestinationNode → recorder / WebRTC peer connection
- AnalyserNodes ×2 → visualizers

Bypass (A/B): raw source routes directly to outputs, chain muted.

Recording: pull processed Float32 frames from the worklet tap → assemble into 48 kHz / 24-bit WAV on export.

## 5. Functional Requirements

### v1 — Live Mic Processing
- Input/output device selection (enumerateDevices + setSinkId)
- Live monitor toggle
- Bypass A/B switch (raw mic vs processed)
- Record → export .wav (48 kHz, 24-bit)
- Real-time spectrogram + oscilloscope + peak VU meter
- 4 presets:
  1. **Krisp Studio Warm** (default) — RNNoise + Warm Velvet EQ + compressor
  2. **Broadcast Standard** — stronger suppression + mud cut + HP 60 Hz emphasis
  3. **Clean Natural** — medium suppression + flat EQ
  4. **Custom** — user-adjustable sliders per band/stage

### v1.1 — Offline File Denoising
- Drag & drop upload (.wav/.mp3/.m4a/.ogg/.flac)
- OfflineAudioContext processing faster than real-time, chunked through same DSP params
- Before/After waveform comparison canvas + download button

### Phase 2 — Dual Engine
- DeepFilterNet WASM added; engine dropdown in UI

## 6. Non-Functional Requirements

- Total latency ≤ 20 ms (128-sample render quantum + worklet ≤5 ms/frame)
- Sample rates 44.1 kHz and 48 kHz supported
- CPU ≤12% on standard hardware (i5/M1+)
- All processing in-memory client-side; no audio leaves the device

## 7. Testing

- Vitest unit tests: preset→node-param mapping, WAV encoder byte-level correctness
- Manual browser validation of the live graph; measured round-trip latency
