// Процедурная партитура в античном духе: печальная тема во фригийском ладу от ре (у греков — «дорийский»),
// кифара (щипок Карплуса — Стронга), авлос (двойная дудка: мелодия + собственный бурдон), тимпан, тихий хор,
// едва слышный пэд и общий зал (свёртка). Музыка дышит: фраза — потом тишина и звуки ночи.
// Настроение уровня (setMood) меняет плотность, тембр и напряжение, не мелодию — тема узнаётся везде.
import { audioCore } from './audio.js';

const MOODS = {
  //        мелодия  пэд   бурдон хор   барабан  диссонанс  темп  регистр
  menu:   { mel: 0.85, aul: 0.6, pad: 0.40, dr: 0.18, ch: 0.10, drum: 0.55,   dis: 0,    bpm: 54, oct: 0, pat: 'calm' },
  story:  { mel: 0.70, aul: 0.55, pad: 0.38, dr: 0.20, ch: 0.15, drum: 0.45,   dis: 0,    bpm: 52, oct: 0, pat: 'calm' },
  field:  { mel: 0.45, aul: 0.45, pad: 0.30, dr: 0.20, ch: 0.05, drum: 0.5,   dis: 0,    bpm: 54, oct: 0, pat: 'calm' },
  ravens: { mel: 0.35, pad: 0.30, dr: 0.24, ch: 0.05, drum: 0.45,   dis: 0.35, bpm: 56, oct: 0, pat: 'calm' },
  hound:  { mel: 0.35, pad: 0.32, dr: 0.26, ch: 0,    drum: 0.4, dis: 0.15, bpm: 58, oct: -12 },
  fog:    { mel: 0.30, aul: 0.5, pad: 0.42, dr: 0.18, ch: 0.25, drum: 0.35,   dis: 0,    bpm: 48, oct: 0, pat: 'calm' },
  fear:   { mel: 0.25, pad: 0.30, dr: 0.38, ch: 0.10, drum: 0.3, dis: 0.5,  bpm: 50, oct: -12 },
  wolves: { mel: 0.30, pad: 0.35, dr: 0.30, ch: 0,    drum: 1.0, dis: 0.2,  bpm: 66, oct: -12 },
  herd:   { mel: 0.40, aul: 0.25, pad: 0.30, dr: 0.22, ch: 0,    drum: 0.7, dis: 0.1,  bpm: 62, oct: 0 },
  pyre:   { mel: 0.90, aul: 0.6, pad: 0.45, dr: 0.20, ch: 0.60, drum: 0.5,   dis: 0,    bpm: 50, oct: 0, pat: 'calm' },
  memory: { mel: 0.20, aul: 0.45, pad: 0.30, dr: 0.12, ch: 0.10, drum: 0.35,   dis: 0,    bpm: 52, oct: 0, pat: 'calm' },
  styx:   { mel: 0.25, aul: 0.3, pad: 0.45, dr: 0.30, ch: 0.50, drum: 0.25,   dis: 0.05, bpm: 46, oct: 0, pat: 'calm' },
  silent: { mel: 0,    pad: 0,    dr: 0,    ch: 0,    drum: 0,   dis: 0,    bpm: 50, oct: 0 },
};
const N = m => 440 * Math.pow(2, (m - 69) / 12);
// тема: [нота MIDI или 0 — пауза, длительность в долях]; ре-минор, 4 фразы по 8 долей
// ре-фригийский: D Eb F G A Bb C — нисходящие тетрахорды, как в греческих напевах
const THEME = [
  [[69, 2], [70, 1], [69, 1], [67, 2], [65, 2]],
  [[67, 1], [69, 1], [70, 2], [69, 3], [0, 1]],
  [[65, 2], [67, 1], [65, 1], [63, 2], [62, 2]],
  [[62, 3], [0, 1], [57, 2], [0, 2]],
  [[72, 2], [70, 1], [69, 1], [70, 2], [69, 2]],
  [[67, 2], [65, 1], [63, 1], [62, 4]],
];
// опоры фраз (древняя музыка — над бурдоном, без аккордовых смен): D D C D Bb C D
const CHORDS = [[50, 57, 62], [50, 57, 62], [48, 55, 60], [50, 57, 62], [46, 53, 58], [48, 55, 60], [50, 57, 62]];

let ctx = null, bus = null, rev = null, dry = null, mood = MOODS.silent, moodName = 'silent';
let timer = null, nextT = 0, phrase = 0, droneNodes = null, padGain = null;
const pluckCache = new Map();

function setup() {
  const core = audioCore(); if (!core) return false;
  if (ctx) return true;
  ctx = core.ac; bus = core.bus;
  // зал: импульс — затухающий шум 3,4 с
  rev = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 3.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  rev.buffer = ir;
  // склейка: мягкий компрессор на всю партитуру + лёгкое сглаживание верха — инструменты в одной комнате
  const glue = ctx.createDynamicsCompressor(); glue.threshold.value = -24; glue.ratio.value = 2.5; glue.attack.value = 0.03; glue.release.value = 0.4; glue.knee.value = 12;
  const tone = ctx.createBiquadFilter(); tone.type = 'highshelf'; tone.frequency.value = 3500; tone.gain.value = -4;
  glue.connect(tone); tone.connect(bus);
  const pre = ctx.createDelay(0.2); pre.delayTime.value = 0.03; pre.connect(rev); revIn = pre;
  const wet = ctx.createGain(); wet.gain.value = 1.0; rev.connect(wet); wet.connect(glue);
  dry = ctx.createGain(); dry.gain.value = 1.5; dry.connect(glue);
  return true;
}
let revIn = null;
// одна отправка в зал для всех (разброс только ±15 %), чтобы не было «разных сцен»
function out(node, wet = 0.6) { node.connect(dry); const s = ctx.createGain(); s.gain.value = 0.62 + (wet - 0.6) * 0.25; node.connect(s); s.connect(revIn || rev); }

function pluck(m, t, vol = 0.3, decay = 0.4985) {
  const key = m + '|' + decay; let buf = pluckCache.get(key);
  if (!buf) {
    const f = N(m), sr = ctx.sampleRate, n = Math.floor(sr * 3), P = Math.max(2, Math.round(sr / f));
    buf = ctx.createBuffer(1, n, sr); const d = buf.getChannelData(0), ring = new Float32Array(P);
    for (let k = 0; k < P; k++) ring[k] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.random());
    let p = 0; for (let k = 0; k < n; k++) { const nx = (p + 1) % P, v = (ring[p] + ring[nx]) * decay; d[k] = ring[p]; ring[p] = v; p = nx; }
    for (let k = 0; k < 200; k++) d[k] *= k / 200;
    pluckCache.set(key, buf);
  }
  const s = ctx.createBufferSource(); s.buffer = buf; const g = ctx.createGain(); g.gain.value = vol;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700;
  s.connect(lp); lp.connect(g); out(g, 0.7); s.start(t);
}
function pad(chord, t, dur, vol) {
  if (vol <= 0) return;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur * 1.05);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 820; lp.Q.value = 0.3;
  lp.connect(g); out(g, 0.8);
  for (const m of chord) for (const det of [-6, 5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = N(m + 12); o.detune.value = det; const og = ctx.createGain(); og.gain.value = 0.05; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur * 1.1); }
}
function choir(m, t, dur, vol) {
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = N(m);
  const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5; vg.gain.value = 4; vib.connect(vg); vg.connect(o.detune);
  for (const [f, q, a] of [[700, 6, 1], [1150, 8, 0.6], [2600, 10, 0.25]]) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const bg = ctx.createGain(); bg.gain.value = a * 0.5; o.connect(bp); bp.connect(bg); bg.connect(g); }
  out(g, 0.9); o.start(t); vib.start(t); o.stop(t + dur); vib.stop(t + dur);
}
// авлос: двойная трость — «носовой» тон с вибрато и мягкой атакой; вторая трубка держит бурдон
function aulos(m, t, dur, vol, slide = 0) {
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.09); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(N(m + slide), t); if (slide) o.frequency.linearRampToValueAtTime(N(m), t + 0.12);
  const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.4; vg.gain.value = 9; vib.connect(vg); vg.connect(o.detune);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1150; bp.Q.value = 1.6;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800;
  o.connect(bp); bp.connect(lp); lp.connect(g); out(g, 0.75);
  o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
}
function aulosDrone(t, dur, vol) {
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = N(50);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 1.2;
  o.connect(bp); bp.connect(g); out(g, 0.7); o.start(t); o.stop(t + dur + 0.05);
}
function drum(t, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5); o.connect(g); out(g, 0.3); o.start(t); o.stop(t + 0.55);
  // кожа тимпана: короткий шум через полосовой фильтр
  const n = ctx.createBufferSource(), len = Math.floor(ctx.sampleRate * 0.08), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  n.buffer = b; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2; const ng = ctx.createGain(); ng.gain.value = vol * 0.25;
  n.connect(bp); bp.connect(ng); out(ng, 0.4); n.start(t);
}
// «тек»: звонкий край тимпана — короткий шум через высокий полосовой фильтр
function tek(t, vol) {
  const len = Math.floor(ctx.sampleRate * 0.06), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const n = ctx.createBufferSource(); n.buffer = b; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 3;
  const g = ctx.createGain(); g.gain.value = vol; n.connect(bp); bp.connect(g); out(g, 0.5); n.start(t);
}
function setDroneLevel(v) {
  if (!droneNodes) {
    const g = ctx.createGain(); g.gain.value = 0; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.connect(g); out(g, 0.5);
    for (const [m, a] of [[38, 0.5], [45, 0.35], [50, 0.15]]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = N(m); const og = ctx.createGain(); og.gain.value = a; o.connect(og); og.connect(lp); o.start(); }
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    droneNodes = g;
  }
  const now = ctx.currentTime; droneNodes.gain.cancelScheduledValues(now); droneNodes.gain.setValueAtTime(droneNodes.gain.value, now); droneNodes.gain.linearRampToValueAtTime(v * 0.22, now + 3);
}

function schedulePhrase(t) {
  const beat = 60 / mood.bpm, bars = 8 * beat;
  const chord = CHORDS[phrase % CHORDS.length];
  pad(chord, t, bars, mood.pad * 0.3);
  // связующий средний слой: мягкая квинта и октава опоры в среднем регистре (между бурдоном и мелодией)
  if (mood.pad > 0) { choir(chord[0] + 12, t, bars * 1.02, 0.035 + mood.pad * 0.05); choir(chord[1] + 12, t + beat * 0.5, bars * 0.98, 0.025 + mood.pad * 0.04); }
  // бас лиры — корень на первую и пятую долю
  if (mood.pad > 0) { pluck(chord[0] - 12, t, 0.2, 0.4993); pluck(chord[0] - 12, t + 4 * beat, 0.14, 0.4993); if (Math.random() < 0.5) pluck(chord[1] - 12, t + 5 * beat, 0.1, 0.4993); }
  // мелодия или «дыхание»
  if (Math.random() < mood.mel) {
    const line = THEME[phrase % THEME.length]; let tt = t;
    const byAulos = mood.aul && Math.random() < mood.aul;
    if (byAulos) aulosDrone(t, bars, 0.035);
    for (const [m, d] of line) {
      if (m && byAulos) { aulos(m + mood.oct, tt, d * beat * 0.95, 0.07, Math.random() < 0.3 ? -1 : 0); tt += d * beat; continue; }
      if (m) {
        const mm = m + mood.oct + (Math.random() < 0.12 ? 12 : 0);
        pluck(mm, tt, 0.17, 0.4988);
        if (Math.random() < 0.18 && d >= 2) pluck(mm + (Math.random() < 0.5 ? 2 : -2), tt + beat * 0.5, 0.12, 0.4985); // украшение
        if (mood.dis > 0 && Math.random() < mood.dis * 0.5) pluck(mm + 1, tt + beat * 0.25, 0.09, 0.498); // диссонанс-«скрежет»
      }
      tt += d * beat;
    }
  } else if (mood.pad > 0 && Math.random() < 0.5) {
    // редкие отдельные ноты в тишине
    for (let k = 0; k < 2; k++) pluck(chord[1 + k % 2] + 12 + mood.oct, t + (2 + k * 3) * beat, 0.12, 0.4988);
  }
  if (mood.ch > 0 && Math.random() < mood.ch) choir(chord[2] + 12, t + beat, bars * 0.85, 0.08);
  if (mood.drum > 0) {
    if (mood.pat === 'calm') { // процессия: дум . тек . | дум дум тек . (тимпан низко — «дум», кожа — «тек»)
      const P = ['D', 0, 'T', 0, 'D', 'D', 'T', 0];
      for (let b = 0; b < 8; b++) { const h = P[b]; if (h === 'D') drum(t + b * beat, 0.28 * mood.drum); else if (h === 'T') tek(t + b * beat, 0.22 * mood.drum); if (Math.random() < 0.15) tek(t + (b + 0.5) * beat, 0.08 * mood.drum); }
    } else for (let b = 0; b < 8; b++) { // сердцебиение: «тук-тук … тук-тук»
      if (b % 2 === 0) { drum(t + b * beat, 0.35 * mood.drum); drum(t + b * beat + beat * 0.32, 0.22 * mood.drum); }
    }
  }
  phrase++;
  return bars;
}
function tick() {
  if (!ctx) return;
  while (nextT < ctx.currentTime + 1.5) {
    const len = schedulePhrase(nextT);
    // после фразы — пауза-вздох (тишина и звуки ночи), чаще в спокойных настроениях
    nextT += len + (Math.random() < 0.55 ? (60 / mood.bpm) * 4 : 0);
  }
}
export function setMood(name) {
  if (!setup()) return;
  if (moodName === name) return;
  moodName = name; mood = MOODS[name] || MOODS.field;
  setDroneLevel(mood.dr);
  if (!timer) { nextT = ctx.currentTime + 0.3; timer = setInterval(tick, 300); }
}
export function currentMood() { return moodName; }
