/**
 * AudioEngine — owns the AudioContext and the full processing graph.
 *
 *   mic → [denoise worklet] → DSP chain → ┬→ monitorGain → destination
 *                                          ├→ pcm-tap (recorder)
 *                                          └→ analysers
 *
 * A/B bypass routes the raw mic straight to the same output bus so the
 * listener can flip between raw/processed without re-negotiating anything.
 */
import {
  RNNOISE_DENOISER,
  type Denoiser,
  type DenoiserNodeHandle,
} from "./denoiser";
import noiseSuppressorWorkletUrl from "../worklets/noise-suppressor.processor.ts?worker&url";
import {
  applyDspParams,
  buildDspChain,
  type DspChain,
} from "../dsp/graph";
import {
  DEFAULT_PRESET_ID,
  PRESETS,
  type DspParams,
} from "./presets";
import { encodeWav } from "./wav-encoder";

export type EngineState = "idle" | "starting" | "running" | "error";

export type EngineListener = (payload: {
  state: EngineState;
  error?: Error;
}) => void;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  private denoiserHandle: DenoiserNodeHandle | null = null;
  private chain: DspChain | null = null;

  private procGain: GainNode | null = null;
  private rawGain: GainNode | null = null;
  private outBus: GainNode | null = null;
  private monitorGain: GainNode | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;
  private recorderTap: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;

  private params: DspParams;
  private currentDenoiser: Denoiser = RNNOISE_DENOISER;

  private bypass = false;
  private monitorOn = false;

  private recording = false;
  private recordChunks: Float32Array[] = [];

  private listeners = new Set<EngineListener>();
  private state: EngineState = "idle";

  constructor(params: DspParams) {
    this.params = params;
  }

  // ------------------------------------------------------------------ state

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): EngineState {
    return this.state;
  }

  private setState(state: EngineState, error?: Error): void {
    this.state = state;
    this.listeners.forEach((l) => l({ state, error }));
  }

  // ------------------------------------------------------------ lifecycle

  async start(inputDeviceId?: string): Promise<void> {
    if (this.ctx) await this.stop();
    this.setState("starting");
    try {
      const ctx = new AudioContext({
        latencyHint: "interactive",
      });
      this.ctx = ctx;

      const constraints: MediaStreamConstraints = {
        audio: {
          ...(inputDeviceId ? { deviceId: { exact: inputDeviceId } } : {}),
          echoCancellation: true,
          autoGainControl: false,
          noiseSuppression: false,
        },
      };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Worklets must be registered before nodes can be created.
      await ctx.audioWorklet.addModule(noiseSuppressorWorkletUrl);

      this.source = ctx.createMediaStreamSource(this.stream);

      // AI denoise stage
      this.denoiserHandle = await this.currentDenoiser.createNode(ctx);

      // DSP mastering chain
      this.chain = buildDspChain(ctx, this.params);

      // Routing bus + branches
      this.procGain = ctx.createGain();
      this.rawGain = ctx.createGain();
      this.outBus = ctx.createGain();
      this.monitorGain = ctx.createGain();
      this.monitorGain.gain.value = this.monitorOn ? 1 : 0;
      this.streamDest = ctx.createMediaStreamDestination();
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.55;

      this.recorderTap = new AudioWorkletNode(ctx, "pcm-tap", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
      });
      this.recorderTap.port.onmessage = (e: MessageEvent) => {
        if (this.recording && e.data?.type === "pcm") {
          this.recordChunks.push(e.data.data as Float32Array);
        }
      };

      // Graph wiring
      this.source.connect(this.denoiserHandle.node);
      this.denoiserHandle.node.connect(this.chain.input);
      this.chain.output.connect(this.procGain);
      this.procGain.connect(this.outBus);

      this.source.connect(this.rawGain);
      this.rawGain.connect(this.outBus);

      this.outBus.connect(this.monitorGain);
      this.monitorGain.connect(ctx.destination);
      this.outBus.connect(this.streamDest);
      this.outBus.connect(this.analyser);
      this.outBus.connect(this.recorderTap);

      this.applyRoutingGains();
      this.pushParams();

      await ctx.resume();
      this.setState("running");
    } catch (err) {
      await this.teardown();
      this.setState(
        "error",
        err instanceof Error ? err : new Error(String(err)),
      );
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.state === "idle") return;
    this.recording = false;
    await this.teardown();
    this.setState("idle");
  }

  private async teardown(): Promise<void> {
    try {
      this.stream?.getTracks().forEach((t) => t.stop());
      this.denoiserHandle?.node.port.close();
      this.recorderTap?.port.close();
      await this.ctx?.close();
    } finally {
      this.ctx = null;
      this.stream = null;
      this.source = null;
      this.denoiserHandle = null;
      this.chain = null;
      this.procGain = this.rawGain = this.outBus = null;
      this.monitorGain = null;
      this.streamDest = null;
      this.recorderTap = null;
      this.analyser = null;
      this.recordChunks = [];
    }
  }

  // ------------------------------------------------------------- controls

  setPreset(params: DspParams): void {
    this.params = params;
    this.pushParams();
  }

  /** Live-update a single custom parameter (called from sliders). */
  updateParams(patch: Partial<DspParams>): void {
    this.params = { ...this.params, ...patch };
    this.pushParams();
  }

  getParams(): Readonly<DspParams> {
    return this.params;
  }

  private pushParams(): void {
    if (!this.ctx || !this.chain) return;
    applyDspParams(this.ctx, this.chain, this.params);
    this.denoiserHandle?.setStrength(this.params.denoiseStrength);
    this.denoiserHandle?.setVadThreshold(this.params.denoiseStrength);
  }

  /** Swap the AI engine at runtime (phase 2: DeepFilterNet). */
  async setEngine(engine: Denoiser): Promise<void> {
    if (!this.ctx || !this.source || !this.chain) {
      this.currentDenoiser = engine;
      return;
    }
    this.currentDenoiser = engine;
    this.denoiserHandle?.node.disconnect();
    this.denoiserHandle = await engine.createNode(this.ctx);
    this.source.connect(this.denoiserHandle.node);
    this.denoiserHandle.node.connect(this.chain.input);
    this.pushParams();
  }

  setBypass(on: boolean): void {
    this.bypass = on;
    this.applyRoutingGains();
  }

  setMonitor(on: boolean, outputDeviceId?: string): Promise<void> {
    this.monitorOn = on;
    if (this.monitorGain && this.ctx) {
      this.monitorGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.01);
    }
    if (on && outputDeviceId && this.ctx) {
      return this.selectOutput(outputDeviceId);
    }
    return Promise.resolve();
  }

  async selectOutput(deviceId: string): Promise<void> {
    const dest = this.ctx?.destination as AudioDestinationNode & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (dest?.setSinkId) await dest.setSinkId(deviceId);
  }

  private applyRoutingGains(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.procGain?.gain.setTargetAtTime(this.bypass ? 0 : 1, t, 0.005);
    this.rawGain?.gain.setTargetAtTime(this.bypass ? 1 : 0, t, 0.005);
  }

  // ------------------------------------------------------------- recording

  startRecording(): void {
    if (!this.ctx) throw new Error("Engine not started");
    this.recordChunks = [];
    this.recording = true;
    this.recorderTap?.port.postMessage({ type: "record", on: true });
  }

  stopRecording(): Blob | null {
    if (!this.ctx) return null;
    this.recorderTap?.port.postMessage({ type: "record", on: false });
    this.recording = false;
    if (this.recordChunks.length === 0) return null;
    const total = this.recordChunks.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const chunk of this.recordChunks) {
      merged.set(chunk, off);
      off += chunk.length;
    }
    this.recordChunks = [];
    return encodeWav([merged], this.ctx.sampleRate);
  }

  // ------------------------------------------------------------ telemetry

  /** Processed-output spectrum for the spectrogram (frequency domain). */
  getSpectrum(target: Uint8Array): boolean {
    if (!this.analyser) return false;
    this.analyser.getByteFrequencyData(target as Uint8Array<ArrayBuffer>);
    return true;
  }

  /** Processed-output waveform for the oscilloscope (time domain). */
  getWaveform(target: Uint8Array): boolean {
    if (!this.analyser) return false;
    this.analyser.getByteTimeDomainData(target as Uint8Array<ArrayBuffer>);
    return true;
  }

  getSampleRate(): number {
    return this.ctx?.sampleRate ?? 0;
  }

  /** Estimated round-trip latency contribution in ms (context + quanta). */
  getLatencyMs(): number {
    if (!this.ctx) return 0;
    const base =
      ((this.ctx.baseLatency ?? 0) + (this.ctx.outputLatency ?? 0)) * 1000;
    // +10 ms algorithmic RNNoise frame delay, +2.7 ms average quantum
    return Math.round(base + 10 + (128 / this.ctx.sampleRate) * 1000);
  }
}

export function createDefaultEngine(): AudioEngine {
  return new AudioEngine({ ...PRESETS[DEFAULT_PRESET_ID].dsp });
}
