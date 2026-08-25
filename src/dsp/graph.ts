/**
 * Studio DSP mastering chain — spec §4 stages 3-9.
 *
 *   highpass 55 Hz → lowshelf 130 → peaking 220 → peaking 500 (mud cut)
 *   → peaking 4.5 kHz (edge softener) → compressor → soft-clip limiter
 *
 * Pure node construction/parameter application; no AudioContext is created
 * here so the same builder works for OfflineAudioContext in v1.1.
 */
import type { DspParams } from "../audio/presets";

export type DspChain = {
  /** Connect the source here. */
  input: BiquadFilterNode;
  /** Connect monitors / recorders / analysers here. */
  output: GainNode;
  nodes: {
    highpass: BiquadFilterNode;
    lowshelf: BiquadFilterNode;
    body: BiquadFilterNode;
    mud: BiquadFilterNode;
    harsh: BiquadFilterNode;
    compressor: DynamicsCompressorNode;
    softClipper: WaveShaperNode;
    ceiling: GainNode;
    masterOut: GainNode;
  };
};

/** dB → linear gain. */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * tanh soft-clip curve — smooth brickwall saturation that never exceeds ±1.
 * Driven at unity gain; the following ceiling GainNode sets −1.5 dBFS.
 */
export function makeSoftClipCurve(samples = 4096): Float32Array {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.2) / Math.tanh(1.2);
  }
  return curve;
}

export function buildDspChain(
  ctx: BaseAudioContext,
  params: DspParams,
): DspChain {
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";

  const lowshelf = ctx.createBiquadFilter();
  lowshelf.type = "lowshelf";

  const body = ctx.createBiquadFilter();
  body.type = "peaking";

  const mud = ctx.createBiquadFilter();
  mud.type = "peaking";

  const harsh = ctx.createBiquadFilter();
  harsh.type = "peaking";

  const compressor = ctx.createDynamicsCompressor();

  const softClipper = ctx.createWaveShaper();
  softClipper.curve = makeSoftClipCurve();
  softClipper.oversample = "4x";

  // Post-shaper trim to the brickwall ceiling (spec: −1.5 dBFS).
  const ceiling = ctx.createGain();

  const masterOut = ctx.createGain();

  highpass.connect(lowshelf);
  lowshelf.connect(body);
  body.connect(mud);
  mud.connect(harsh);
  harsh.connect(compressor);
  compressor.connect(softClipper);
  softClipper.connect(ceiling);
  ceiling.connect(masterOut);

  const chain: DspChain = {
    input: highpass,
    output: masterOut,
    nodes: {
      highpass,
      lowshelf,
      body,
      mud,
      harsh,
      compressor,
      softClipper,
      ceiling,
      masterOut,
    },
  };
  applyDspParams(ctx, chain, params);
  return chain;
}

/** Push a parameter set onto an existing chain (used by presets/custom EQ). */
export function applyDspParams(
  _ctx: BaseAudioContext,
  chain: DspChain,
  params: DspParams,
  now?: number,
): void {
  const t = now ?? _ctx.currentTime;
  const set = (
    param: AudioParam & { value: number },
    value: number,
  ): void => {
    param.setTargetAtTime(value, t, 0.01);
  };

  const n = chain.nodes;
  n.highpass.frequency.setTargetAtTime(params.hpFreq, t, 0.01);
  n.highpass.Q.setTargetAtTime(params.hpQ, t, 0.01);

  n.lowshelf.frequency.setTargetAtTime(params.lowshelfFreq, t, 0.01);
  set(n.lowshelf.gain as AudioParam & { value: number }, params.lowshelfGain);

  n.body.frequency.setTargetAtTime(params.bodyFreq, t, 0.01);
  n.body.Q.setTargetAtTime(params.bodyQ, t, 0.01);
  set(n.body.gain as AudioParam & { value: number }, params.bodyGain);

  n.mud.frequency.setTargetAtTime(params.mudFreq, t, 0.01);
  n.mud.Q.setTargetAtTime(params.mudQ, t, 0.01);
  set(n.mud.gain as AudioParam & { value: number }, params.mudGain);

  n.harsh.frequency.setTargetAtTime(params.harshFreq, t, 0.01);
  n.harsh.Q.setTargetAtTime(params.harshQ, t, 0.01);
  set(n.harsh.gain as AudioParam & { value: number }, params.harshGain);

  n.compressor.threshold.setTargetAtTime(params.compThreshold, t, 0.01);
  n.compressor.ratio.setTargetAtTime(params.compRatio, t, 0.01);
  n.compressor.attack.setTargetAtTime(params.compAttack, t, 0.01);
  n.compressor.release.setTargetAtTime(params.compRelease, t, 0.01);
  n.compressor.knee.setTargetAtTime(6, t, 0.01);

  n.ceiling.gain.setTargetAtTime(dbToGain(params.limiterCeilingDb), t, 0.01);
}
