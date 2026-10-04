// Звук: сэмплы из библиотеки автора (HRL/Звуки для игр, звуки NO Flat) + синтез лиры (Карплус — Стронг),
// петли эмбиента (дождь, ночь, огонь, вой) с плавными переходами, музыка автора (HRL/Музыка) с кроссфейдом.
const AC = window.AudioContext || window.webkitAudioContext;
let ac = null, master, sfxBus, ambBus, comp, scoreBus;
const buffers = new Map();
export const audioState = { sfx: 0.9, music: 0.5, muted: false };

export const SFX_FILES = ['flip', 'miss', 'click', 'harp_ok', 'harp1', 'harp_bad', 'coin', 'coin2', 'drink', 'thunder', 'thunder2',
  'bolt', 'fire', 'rain', 'night', 'owl', 'crow', 'crow2', 'howl', 'growl', 'attack', 'howls', 'blade', 'bones', 'swing', 'swing2',
  'slash', 'gong', 'chord', 'sting', 'laugh', 'wind', 'sacred', 'str51', 'str61', 'str71', 'str81', 'str101', 'steps', 'groan',
  'snarl', 'monster', 'dread', 'gallop', 'club', 'bells', 'lyre_dark', 'storm', 'whiff', 'drop', 'air', 'draw', 'hiss'];

function ensure() {
  if (ac || !AC) return;
  ac = new AC();
  master = ac.createGain(); master.connect(ac.destination);
  comp = ac.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 3; comp.connect(master);
  sfxBus = ac.createGain(); sfxBus.connect(comp);
  ambBus = ac.createGain(); ambBus.connect(comp);
  scoreBus = ac.createGain(); scoreBus.connect(comp);
  applyVolumes();
}
export function initAudio() { ensure(); if (ac && ac.state === 'suspended') ac.resume(); musicKick(); }
export function applyVolumes() {
  if (ac) {
    master.gain.value = audioState.muted ? 0 : 1;
    sfxBus.gain.value = audioState.sfx;
    ambBus.gain.value = audioState.sfx * 0.9;
    scoreBus.gain.value = audioState.music;
  }
  for (const m of music.els) m.el.volume = Math.max(0, Math.min(1, m.v * (audioState.muted ? 0 : audioState.music)));
}
export function suspendAudio(on) {
  if (ac) on ? ac.suspend() : ac.resume();
  for (const m of music.els) on ? m.el.pause() : (m.target > 0 && m.el.play().catch(() => {}));
}

export async function loadSounds(base = 'assets/sfx/') {
  ensure(); if (!ac) return;
  await Promise.all(SFX_FILES.map(async n => {
    try { const r = await fetch(base + n + '.mp3'); const b = await r.arrayBuffer(); buffers.set(n, await ac.decodeAudioData(b)); } catch { }
  }));
}

const lastPlay = new Map();
// opts: vol, rate, jitter (разброс высоты), pan, gap (не чаще), offset, dur
export function sfx(name, opts = {}) {
  if (!ac || audioState.muted) return null;
  const buf = buffers.get(name); if (!buf) return null;
  const now = ac.currentTime;
  if ((lastPlay.get(name) || -1) > now - (opts.gap ?? 0.04)) return null;
  lastPlay.set(name, now);
  const src = ac.createBufferSource(); src.buffer = buf;
  src.playbackRate.value = (opts.rate ?? 1) * (1 + (Math.random() - 0.5) * (opts.jitter ?? 0.06));
  const g = ac.createGain(); g.gain.value = opts.vol ?? 1;
  let node = g;
  if (opts.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = opts.pan; g.connect(p); node = p; }
  src.connect(g); node.connect(sfxBus);
  src.start(now + (opts.delay || 0), opts.offset || 0, opts.dur);
  return src;
}

// ---- Эмбиент: именованные петли с плавной громкостью
const amb = new Map();
export function setAmbient(levels, fade = 1.5) {
  if (!ac) return;
  const now = ac.currentTime;
  for (const [name, v] of Object.entries(levels)) {
    let a = amb.get(name);
    if (!a && v > 0) {
      const buf = buffers.get(name); if (!buf) continue;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const g = ac.createGain(); g.gain.value = 0; src.connect(g); g.connect(ambBus);
      src.start(now, Math.random() * buf.duration * 0.5); a = { src, g }; amb.set(name, a);
    }
    if (a) { a.g.gain.cancelScheduledValues(now); a.g.gain.setValueAtTime(a.g.gain.value, now); a.g.gain.linearRampToValueAtTime(v, now + fade); }
  }
}
export function ambientOff(fade = 1.5) { const o = {}; for (const k of amb.keys()) o[k] = 0; setAmbient(o, fade); }

// ---- Лира: щипок струны по Карплусу — Стронгу (для «Плача» — запоминания последовательности)
const LYRE = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66]; // ре-дорийский пентатонический ряд
const lyreCache = new Map();
export function lyre(i, vol = 0.7) {
  if (!ac || audioState.muted) return;
  const f = LYRE[i % LYRE.length] * (i >= LYRE.length ? 2 : 1);
  let buf = lyreCache.get(i);
  if (!buf) {
    const sr = ac.sampleRate, n = Math.floor(sr * 2.4), N = Math.round(sr / f);
    buf = ac.createBuffer(1, n, sr); const d = buf.getChannelData(0); const ring = new Float32Array(N);
    for (let k = 0; k < N; k++) ring[k] = Math.random() * 2 - 1;
    let p = 0;
    for (let k = 0; k < n; k++) { const nx = (p + 1) % N; const v = (ring[p] + ring[nx]) * 0.4985; d[k] = ring[p]; ring[p] = v; p = nx; }
    // мягкая атака и чуть «бронзы»
    for (let k = 0; k < 120; k++) d[k] *= k / 120;
    lyreCache.set(i, buf);
  }
  const src = ac.createBufferSource(); src.buffer = buf;
  const g = ac.createGain(); g.gain.value = vol; src.connect(g); g.connect(sfxBus); src.start();
}

// ---- Гул: тихий низкий дрон под напряжённые моменты (жажда, Фобос)
let drone = null;
export function setDrone(v) {
  if (!ac) return;
  if (!drone) {
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o1.type = 'sawtooth'; o1.frequency.value = 55; o2.type = 'sawtooth'; o2.frequency.value = 55.6;
    f.type = 'lowpass'; f.frequency.value = 220; g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(ambBus); o1.start(); o2.start(); drone = g;
  }
  const now = ac.currentTime; drone.gain.cancelScheduledValues(now); drone.gain.setValueAtTime(drone.gain.value, now);
  drone.gain.linearRampToValueAtTime(v * 0.12, now + 1.2);
}

// ---- Музыка: треки автора, кроссфейд двумя элементами <audio>
const music = { els: [], cur: null };
const MUSIC = { olympus: 'olympus', hercules: 'hercules', birth: 'birth', hercules2: 'hercules2', birth2: 'birth2', abyss: 'abyss' };
export function playMusic(name, vol = 0.55) {
  if (music.cur === name) return;
  music.cur = name;
  for (const m of music.els) m.target = 0;
  if (!name || !MUSIC[name]) return;
  const el = new Audio('assets/music/' + MUSIC[name] + '.mp3'); el.loop = true; el.volume = 0;
  const m = { el, v: 0, target: vol, name }; music.els.push(m);
  el.play().catch(() => { m.blocked = true; });
}
function musicKick() { for (const m of music.els) if (m.blocked && m.target > 0) { m.blocked = false; m.el.play().catch(() => { m.blocked = true; }); } }
export function musicDuck(k) { music.duck = k; }
setInterval(() => {
  for (let i = music.els.length - 1; i >= 0; i--) {
    const m = music.els[i], tgt = m.target * (music.duck ?? 1);
    m.v += Math.sign(tgt - m.v) * Math.min(Math.abs(tgt - m.v), 0.025);
    m.el.volume = Math.max(0, Math.min(1, m.v * (audioState.muted ? 0 : audioState.music)));
    if (m.target === 0 && m.v <= 0.001) { m.el.pause(); music.els.splice(i, 1); }
  }
}, 50);

// доступ к контексту для процедурной партитуры (score.js)
export function audioCore() { ensure(); return ac ? { ac, bus: scoreBus } : null; }
// отвод общего выхода (для записи проб звука инструментом tools/musicprobe.mjs)
export function tapOutput() { ensure(); if (!ac) return null; const d = ac.createMediaStreamDestination(); master.connect(d); return d; }
