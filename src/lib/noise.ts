/** Ambient noise made in the browser: white, pink and brown noise, looped, with a volume control. */

export type NoiseKind = "white" | "pink" | "brown";
export const NOISE_KINDS: { kind: NoiseKind; label: string; hint: string }[] = [
  { kind: "white", label: "White", hint: "Bright, like a fan" },
  { kind: "pink", label: "Pink", hint: "Softer, like steady rain" },
  { kind: "brown", label: "Brown", hint: "Deep, like a distant waterfall" },
];

const clip = (x: number) => Math.max(-1, Math.min(1, x));

/** Fills `out` with noise of the given colour, in the range -1..1. `random` returns 0..1. */
export function fillNoise(
  kind: NoiseKind,
  out: Float32Array,
  random: () => number = Math.random,
): void {
  if (kind === "white") {
    for (let i = 0; i < out.length; i++) out[i] = random() * 2 - 1;
    return;
  }
  if (kind === "pink") {
    // Paul Kellet's economy filter: white noise shaped to fall off at 3 dB per octave.
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < out.length; i++) {
      const white = random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      out[i] = clip((b0 + b1 + b2 + white * 0.1848) * 0.15);
    }
    return;
  }
  // Brown: integrated white noise with a slight leak so it never drifts away.
  let last = 0;
  for (let i = 0; i < out.length; i++) {
    const white = random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    out[i] = clip(last * 3.5);
  }
}

let context: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;
let playing: NoiseKind | null = null;

/** Starts (or switches) the noise. Must be called from a user action the first time (browser autoplay rules). */
export function playNoise(kind: NoiseKind, volume: number): void {
  if (typeof window === "undefined") return;
  if (playing === kind && source) {
    setNoiseVolume(volume);
    return;
  }
  stopNoise();
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  context = context ?? new AudioCtx();
  void context.resume();
  const seconds = 4;
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  fillNoise(kind, buffer.getChannelData(0));
  source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  gain = context.createGain();
  gain.gain.value = volume;
  source.connect(gain).connect(context.destination);
  source.start();
  playing = kind;
}

export function setNoiseVolume(volume: number): void {
  if (gain && context) gain.gain.setTargetAtTime(volume, context.currentTime, 0.05);
}

export function stopNoise(): void {
  try {
    source?.stop();
  } catch {
    // Already stopped.
  }
  source?.disconnect();
  gain?.disconnect();
  source = null;
  gain = null;
  playing = null;
}

export const noisePlaying = (): NoiseKind | null => playing;
