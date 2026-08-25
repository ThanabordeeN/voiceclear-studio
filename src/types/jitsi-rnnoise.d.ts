declare module "@jitsi/rnnoise-wasm/dist/rnnoise.js" {
  /**
   * Emscripten module factory for RNNoise (rnnoise 0.2, frame size 480).
   * Low-level C exports wrapped by our worklet processor.
   */
  export interface RnnoiseEmscriptenModule {
    ready: Promise<unknown>;
    _rnnoise_create(model: number): number;
    _rnnoise_process_frame(
      st: number,
      out: number,
      input: number,
    ): number; // returns VAD probability 0..1
    _rnnoise_destroy(st: number): void;
    _malloc(size: number): number;
    _free(ptr: number): void;
    HEAPF32: Float32Array;
  }
  function createRnnoiseModule(
    moduleOverrides?: { wasmBinary?: ArrayBuffer | Uint8Array },
  ): RnnoiseEmscriptenModule;
  export default createRnnoiseModule;
}
