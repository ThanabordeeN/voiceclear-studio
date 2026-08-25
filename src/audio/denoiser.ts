/**
 * AI denoiser engines.
 *
 * The engine runs inside the "noise-suppressor" AudioWorklet; this module is
 * the main-thread side responsible for loading the worklet bundle and feeding
 * it the compiled WASM binary. New engines (e.g. DeepFilterNet) implement the
 * same {@link Denoiser} interface and become selectable in the UI.
 */
import noiseSuppressorWorkletUrl from "../worklets/noise-suppressor.processor.ts?worker&url";

const RNNOISE_WASM_URL = "/worklets/rnnoise.wasm";

export type DenoiserId = "rnnoise";

export type WorkletTelemetry =
  | { type: "ready" }
  | { type: "error"; error: string }
  | { type: "vad"; vad: number; gate: number };

export type DenoiserNodeHandle = {
  node: AudioWorkletNode;
  /** Resolves once the engine inside the worklet is ready to process. */
  ready: Promise<void>;
  /** 0..1 — wet/dry mix of the suppression output. */
  setStrength(value: number): void;
  /** 0..1 — speech-probability gate threshold. */
  setVadThreshold(value: number): void;
};

export type Denoiser = {
  id: DenoiserId;
  nameEn: string;
  nameTh: string;
  createNode(ctx: AudioContext): Promise<DenoiserNodeHandle>;
};

async function loadWorkletModule(ctx: AudioContext): Promise<void> {
  // addModule resolves when the module has been evaluated; processors are
  // then registered and constructible.
  await ctx.audioWorklet.addModule(noiseSuppressorWorkletUrl);
}

export const RNNOISE_DENOISER: Denoiser = {
  id: "rnnoise",
  nameEn: "RNNoise (lightweight)",
  nameTh: "RNNoise (เบา)",
  async createNode(ctx: AudioContext): Promise<DenoiserNodeHandle> {
    await loadWorkletModule(ctx);
    const node = new AudioWorkletNode(ctx, "noise-suppressor", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      outputChannelCount: [1],
    });

    let resolveReady: () => void;
    let rejectReady: (err: unknown) => void;
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    node.port.onmessage = (e: MessageEvent<WorkletTelemetry>) => {
      const msg = e.data;
      if (msg.type === "ready") resolveReady();
      else if (msg.type === "error") rejectReady(new Error(msg.error));
    };

    const resp = await fetch(RNNOISE_WASM_URL);
    if (!resp.ok) throw new Error(`Failed to load RNNoise WASM (${resp.status})`);
    const wasmBinary = await resp.arrayBuffer();
    node.port.postMessage({ type: "init", wasmBinary }, [wasmBinary]);

    return {
      node,
      ready,
      setStrength(value: number) {
        node.port.postMessage({ type: "strength", value });
      },
      setVadThreshold(value: number) {
        node.port.postMessage({ type: "vadThreshold", value });
      },
    };
  },
};

/** Engines offered in the UI (phase 2 will append DeepFilterNet here). */
export const DENOISER_ENGINES: Denoiser[] = [RNNOISE_DENOISER];
