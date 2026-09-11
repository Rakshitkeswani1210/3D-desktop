/**
 * audio.js — the click, synthesised. No audio files, for the same reason there
 * are no image files: everything is a number you can tune.
 *
 * The iPod tick is a very dry, very short transient: a burst of noise squeezed
 * through a narrow bandpass with a near-instant decay, plus a tiny sine to give
 * it body. Three variants, because a wheel button, the centre select and a
 * scroll tick are noticeably different sounds on the real device.
 *
 * Two things that will bite if they are missed:
 *   - AudioContext starts suspended under the autoplay policy. It has to be
 *     resumed inside a real user gesture, which is why unlock() is called from
 *     pointerdown rather than at load.
 *   - Scroll ticks fire in bursts of dozens. Everything runs through a
 *     compressor so a fast spin cannot clip.
 */

let ctx = null;
let master = null;
let noiseBuffer = null;
let enabled = true;

/** Per-variant voicing. Frequencies in Hz, durations in seconds. */
const VOICES = {
  // A wheel button: crisp and high.
  button: { freq: 2350, q: 1.1, dur: 0.030, gain: 0.34, body: 620, bodyGain: 0.10 },
  // Centre select: lower and fuller, so it reads as a bigger, deeper button.
  select: { freq: 1450, q: 0.9, dur: 0.048, gain: 0.40, body: 380, bodyGain: 0.16 },
  // A scroll tick: quieter and shorter still, because you hear many in a row.
  tick:   { freq: 3150, q: 1.7, dur: 0.014, gain: 0.15, body: 0,   bodyGain: 0 },
  // A tower's power switch: a chunky mechanical latch, not a click. Long body,
  // low noise burst — the sound of something with a spring in it.
  power:  { freq: 780,  q: 0.7, dur: 0.075, gain: 0.30, body: 165, bodyGain: 0.30 },
  // A CRT degaussing as it wakes: almost no transient, all body, pitched down
  // over a tenth of a second. This is the one sound everyone remembers.
  degauss:{ freq: 220,  q: 0.5, dur: 0.130, gain: 0.10, body: 92,  bodyGain: 0.42 },
};

/**
 * Master level.
 *
 * Dropped from 0.9 after three people said the scene was too loud. This is a
 * thing that autoplays on a page somebody opened at work, so it should sit
 * under the room rather than over it.
 */
const MASTER = 0.7;

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;

  ctx = new AC();

  // Safety net for fast wheel spins: many overlapping transients would clip an
  // unprotected master bus.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 12;
  comp.ratio.value = 8;
  comp.attack.value = 0.002;
  comp.release.value = 0.12;

  master = ctx.createGain();
  master.gain.value = MASTER;
  master.connect(comp);
  comp.connect(ctx.destination);

  // 0.2 s of white noise, generated once and re-triggered per click.
  const n = Math.floor(ctx.sampleRate * 0.2);
  noiseBuffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;

  return true;
}

/**
 * Resume the audio context. MUST be called from inside a user gesture —
 * pointerdown — or the first click of the session is silent.
 */
export function unlock() {
  try {
    if (!ctx && !build()) return;
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    // No audio available (blocked, or no device). Everything else still works.
    ctx = null;
  }
}

/** Turn sound on or off. */
export function setEnabled(on) {
  enabled = on;
  if (master) master.gain.value = on ? MASTER : 0;
}

export const isEnabled = () => enabled;

/** Diagnostics: context state and how many clicks have actually been voiced. */
export const state = () => ({ ctx: ctx ? ctx.state : null, enabled, played });
let played = 0;

/**
 * Fire one click.
 * @param {'button'|'select'|'tick'} variant
 */
export function click(variant = 'button') {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  played++;
  const v = VOICES[variant] ?? VOICES.button;
  const t = ctx.currentTime;

  // A little jitter per hit, so a rapid spin never sounds like a loop.
  const jf = 1 + (Math.random() - 0.5) * 0.16;
  const jg = 1 + (Math.random() - 0.5) * 0.3;

  const out = ctx.createGain();
  out.gain.setValueAtTime(v.gain * jg, t);
  // Ramps cannot reach exactly zero, hence the tiny floor.
  out.gain.exponentialRampToValueAtTime(0.0001, t + v.dur);
  out.connect(master);

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.playbackRate.value = 0.85 + Math.random() * 0.3;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(v.freq * jf, t);
  bp.Q.value = v.q;

  noise.connect(bp);
  bp.connect(out);
  noise.start(t);
  noise.stop(t + v.dur + 0.01);

  // The body: a short sine thump that stops the tick sounding papery.
  if (v.body) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(v.body * jf, t);
    osc.frequency.exponentialRampToValueAtTime(v.body * 0.55, t + v.dur);

    const og = ctx.createGain();
    og.gain.setValueAtTime(v.bodyGain * jg, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + v.dur * 0.8);

    osc.connect(og);
    og.connect(master);
    osc.start(t);
    osc.stop(t + v.dur + 0.01);
  }
}

/* ─────────────────────────── the fan ───────────────────────────
 * A running tower is never silent. Two narrow bandpasses over the same noise
 * buffer give the two things you actually hear: a low airflow rush, and the
 * whine of a bearing an octave and a half above it.
 *
 * Started and stopped by long gain ramps rather than by starting and stopping
 * the nodes. A hard start on a noise source is an audible click, and the fan is
 * meant to arrive under the power-button thunk without being noticed.
 */

let hum = null;

/** Spin the fan up over `ramp` seconds. Safe to call twice. */
export function startHum(ramp = 1.6) {
  if (!ctx || ctx.state !== 'running' || hum) return;

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, ctx.currentTime);
  // Halved: the fan is meant to be the thing you stop noticing, not the
  // thing you turn down.
  out.gain.exponentialRampToValueAtTime(0.026, ctx.currentTime + ramp);
  out.connect(master);

  const air = ctx.createBiquadFilter();
  air.type = 'bandpass';
  air.frequency.value = 190;
  air.Q.value = 0.8;

  const whine = ctx.createBiquadFilter();
  whine.type = 'bandpass';
  whine.frequency.value = 640;
  whine.Q.value = 6;

  const whineGain = ctx.createGain();
  whineGain.gain.value = 0.18;   // the bearing, well under the airflow

  src.connect(air);
  air.connect(out);
  src.connect(whine);
  whine.connect(whineGain);
  whineGain.connect(out);
  src.start();

  hum = { src, out };
}

/** Spin the fan down and release its nodes. */
export function stopHum(ramp = 0.8) {
  if (!hum) return;
  const { src, out } = hum;
  hum = null;
  const t = ctx.currentTime;
  out.gain.cancelScheduledValues(t);
  out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
  out.gain.exponentialRampToValueAtTime(0.0001, t + ramp);
  src.stop(t + ramp + 0.05);
}
