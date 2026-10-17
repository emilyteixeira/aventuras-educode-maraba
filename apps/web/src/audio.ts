// Trilha e efeitos 100% procedurais (Web Audio): sem arquivos, sem licenças.
// Só inicia após clique do usuário (política dos navegadores e regra do projeto).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicTimer: number | undefined;
let musicOn = false;
let sfxOn = true;
let step = 0;

const CHORDS: number[][] = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
];
const PENTA = [69, 72, 74, 76, 79, 81]; // A menor pentatônica (A4…A5)

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, t0: number, dur: number, type: OscillatorType, gain: number, dest?: AudioNode) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.08, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest ?? master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function playBar() {
  if (!ctx || !master) return;
  const t = ctx.currentTime + 0.05;
  const chord = CHORDS[step % CHORDS.length];
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  lp.connect(master);
  chord.forEach((m, i) => tone(hz(m - 12 * (i === 0 ? 1 : 0)), t, 4.2, "triangle", 0.07, lp));
  // arpejo esparso e misterioso
  for (let k = 0; k < 8; k++) {
    if (Math.random() < 0.62) {
      const n = PENTA[Math.floor(Math.random() * PENTA.length)];
      tone(hz(n), t + k * 0.5, 1.2, "sine", 0.045);
    }
  }
  step++;
}

export function setMusic(on: boolean) {
  musicOn = on;
  if (on) {
    if (!ensure()) return;
    if (musicTimer === undefined) {
      playBar();
      musicTimer = window.setInterval(playBar, 4000);
    }
  } else if (musicTimer !== undefined) {
    window.clearInterval(musicTimer);
    musicTimer = undefined;
  }
}

export const isMusicOn = () => musicOn;
export function setSfx(on: boolean) {
  sfxOn = on;
}

export type Sfx = "click" | "correct" | "wrong" | "tick" | "fanfare" | "tool";

export function sfx(kind: Sfx) {
  if (!sfxOn || !ensure() || !ctx) return;
  const t = ctx.currentTime;
  switch (kind) {
    case "click":
      tone(660, t, 0.08, "square", 0.04);
      break;
    case "tool":
      tone(520, t, 0.12, "triangle", 0.08);
      tone(780, t + 0.08, 0.2, "triangle", 0.08);
      break;
    case "correct":
      [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.09, 0.3, "triangle", 0.12));
      break;
    case "wrong":
      tone(220, t, 0.25, "sawtooth", 0.07);
      tone(165, t + 0.12, 0.35, "sawtooth", 0.07);
      break;
    case "tick":
      tone(900, t, 0.05, "square", 0.03);
      break;
    case "fanfare":
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, t + i * 0.13, 0.4, "triangle", 0.12));
      break;
  }
}

export function unlockAudioOnGesture() {
  ensure();
}
