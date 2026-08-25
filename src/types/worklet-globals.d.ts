/**
 * Ambient globals available inside AudioWorkletGlobalScope.
 * (Some TS lib.dom versions do not expose these; declare defensively.)
 */
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
}
declare function registerProcessor(
  name: string,
  processorCtor: new (options?: unknown) => AudioWorkletProcessor,
): void;
