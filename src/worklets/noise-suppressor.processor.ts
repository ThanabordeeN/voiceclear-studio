/**
 * AudioWorklet processors for VoiceClear Studio.
 *
 * "noise-suppressor" — AI noise suppression via RNNoise WASM.
 *   Runs on the audio render thread. Receives the compiled .wasm binary over
 *   the node message port (AudioWorkletGlobalScope has no fetch guarantees),
 *   accumulates 128-sample render quanta into 480-sample RNNoise frames
 *   (10 ms @ 48 kHz), and emits denoised audio plus VAD telemetry.
 *   Algorithmic latency: exactly one 480-sample frame (10 ms).
 *
 * "pcm-tap" — pass-through recorder tap used by the engine to capture the
 *   final processed signal for WAV export.
 */
import createRnnoiseModule, {
  type RnnoiseEmscriptenModule,
} from "@jitsi/rnnoise-wasm/dist/rnnoise.js";

const FRAME_SIZE = 480;

type WorkletInMessage =
  | { type: "init"; wasmBinary: ArrayBuffer }
  | { type: "strength"; value: number }
  | { type: "vadThreshold"; value: number };

class NoiseSuppressorProcessor extends AudioWorkletProcessor {
  private module: RnnoiseEmscriptenModule | null = null;
  private statePtr = 0;
  private inPtr = 0;
  private outPtr = 0;
  /** Accumulator for incoming render quanta until a full 480-sample frame. */
  private pending = new Float32Array(FRAME_SIZE);
  private pendingFill = 0;
  /** Output FIFO of already-denoised samples awaiting playback. */
  private outFifo = new Float32Array(FRAME_SIZE * 2);
  private outLen = 0;
  /** Denoise mix 0..1 (1 = full suppression). */
  private strength = 0.85;
  /** VAD gate threshold — frames below this speech probability get gated. */
  private vadThreshold = 0.85;
  private smoothedVad = 1;
  private frameCounter = 0;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<WorkletInMessage>) => {
      const msg = e.data;
      if (msg.type === "init") {
        this.initWasm(msg.wasmBinary);
      } else if (msg.type === "strength") {
        this.strength = Math.min(1, Math.max(0, msg.value));
      } else if (msg.type === "vadThreshold") {
        this.vadThreshold = Math.min(1, Math.max(0, msg.value));
      }
    };
  }

  private initWasm(binary: ArrayBuffer): void {
    try {
      const mod = createRnnoiseModule({ wasmBinary: new Uint8Array(binary) });
      void Promise.resolve(mod.ready).then(() => {
        this.module = mod;
        this.statePtr = mod._rnnoise_create(0 /* default model */);
        this.inPtr = mod._malloc(FRAME_SIZE * 4);
        this.outPtr = mod._malloc(FRAME_SIZE * 4);
        this.port.postMessage({ type: "ready" });
      });
    } catch (err) {
      this.port.postMessage({ type: "error", error: String(err) });
    }
  }

  public process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!input || !output) return true;

    // 1. Feed the frame accumulator; run RNNoise on every complete frame.
    let read = 0;
    while (read < input.length) {
      const take = Math.min(input.length - read, FRAME_SIZE - this.pendingFill);
      this.pending.set(input.subarray(read, read + take), this.pendingFill);
      this.pendingFill += take;
      read += take;
      if (this.pendingFill === FRAME_SIZE) {
        this.runDenoise(this.pending);
        this.pendingFill = 0;
      }
    }

    // 2. Drain exactly one quantum of denoised audio from the FIFO.
    const n = Math.min(output.length, this.outLen);
    output.set(this.outFifo.subarray(0, n));
    if (n < output.length) output.fill(0, n); // startup: not enough yet
    this.outFifo.copyWithin(0, n, this.outLen);
    this.outLen -= n;
    return true;
  }

  private runDenoise(frame: Float32Array): void {
    const mod = this.module;
    if (!mod || !this.statePtr) return; // not initialised yet

    mod.HEAPF32.set(frame, this.inPtr >> 2);
    const vad = mod._rnnoise_process_frame(
      this.statePtr,
      this.outPtr,
      this.inPtr,
    );
    this.frameCounter++;

    // Soft VAD gate: attenuate non-speech frames proportionally to the
    // sensitivity setting (spec §4: VAD sensitivity 0.85).
    this.smoothedVad = this.smoothedVad * 0.7 + vad * 0.3;
    const gate =
      this.smoothedVad >= this.vadThreshold
        ? 1
        : Math.max(0, this.smoothedVad / Math.max(this.vadThreshold, 0.001));
    const mix = Math.min(1, this.strength);

    const clean = mod.HEAPF32.subarray(
      this.outPtr >> 2,
      (this.outPtr >> 2) + FRAME_SIZE,
    );

    // Append denoised frame to output FIFO (guaranteed space: we drain one
    // quantum ≈ 128 samples per call and add 480 only every ~3-4 calls).
    for (let i = 0; i < FRAME_SIZE; i++) {
      const wet = clean[i] * gate;
      this.outFifo[this.outLen++] = frame[i] * (1 - mix) + wet * mix;
    }

    // Telemetry ~ every 10 frames (~100 ms)
    if (this.frameCounter % 10 === 0) {
      this.port.postMessage({ type: "vad", vad: this.smoothedVad, gate });
    }
  }
}

/**
 * Pass-through tap: forwards every input sample to the main thread as a
 * transferable Float32Array while passing audio through untouched.
 */
class PcmTapProcessor extends AudioWorkletProcessor {
  private recording = false;

  constructor() {
    super();
    this.port.onmessage = (
      e: MessageEvent<{ type: "record"; on: boolean }>,
    ) => {
      if (e.data.type === "record") this.recording = e.data.on;
    };
  }

  public process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input) return true;
    if (this.recording) {
      const copy = new Float32Array(input);
      this.port.postMessage({ type: "pcm", data: copy }, [copy.buffer]);
    }
    return true;
  }
}

registerProcessor("noise-suppressor", NoiseSuppressorProcessor);
registerProcessor("pcm-tap", PcmTapProcessor);
