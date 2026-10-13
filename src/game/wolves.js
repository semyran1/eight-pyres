// Ночь волков — интерлюдия-бой по задумке автора (Slice: овцы «Бро», волки «Небро»; план NO Flat 1.5).
// toward — «как Fruit Ninja»: звери выходят из тумана навстречу отцу, в круге света решаешь — рубить или нет;
// разрубленный волк разлетается половинками. herd — охрана стада, собранного в ночах toward (свайп по волку, вожаку 2 удара).
import { NIGHTS } from './data.js';
import { img, W, H, text, button, comicBox, drawCam, drawPost, STYLE } from '../art/gfx.js';
import { pxSprite, pxSpriteFlip, pxLine, pxCampfire, SPR, PAL, SPR_TW, pxSpriteCanvas, pxFogBank, pxGroundPlane, pxFogField, pxLightPool } from '../art/pixel.js';
import { sfx, setAmbient, playMusic } from '../engine/audio.js';
import { setMood } from '../engine/score.js';
import { rand, pick, clamp, TAU, Particles, lerp } from '../engine/util.js';
import { drawPause, pauseButton } from './ui.js';
import { LANG } from './i18n.js';

const GROUND0 = 330, GROUND1 = 505;
// ---- «навстречу» v2 (тренажёр реакции): псевдо-3D. Горизонт HZ, земля у отца YF; u — глубина 0…1.
// Из тумана — только тёмные силуэты; кромка круга света ZONE (u) — там видно, кто это; дальше ~1 с на решение.
const HZ = 300, YF = 528, FOG = '#6a6e7e', BITE = 0.18; // BITE — через сколько после начала прыжка укус
let ZONE = 0.64;
const gy = u => HZ + (YF - HZ) * Math.pow(Math.max(0, u), 1.3);
const spread = u => 26 + 450 * Math.pow(Math.max(0, u), 1.3);
const scl = u => 0.14 + 0.88 * Math.pow(Math.max(0, u), 1.4);
const litU = X => ZONE + 0.04 * X * X; // у краёв круг света чуть ближе к отцу (эллипс)
const arcY = x => gy(litU(clamp((x - 480) / spread(ZONE), -2.2, 2.2)));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const RGB = new Map();
function rgb(h) { let v = RGB.get(h); if (!v) { const n = parseInt(h.slice(1), 16); v = [n >> 16, (n >> 8) & 255, n & 255]; RGB.set(h, v); } return v; }
function mix(a, b, t) {
  if (t <= 0.001) return a; if (t >= 0.999) return b;
  const A = rgb(a[0] === '#' ? a : '#000000'), B = rgb(b);
  if (a[0] !== '#') return a;
  return '#' + [0, 1, 2].map(i => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join('');
}
// пиксельные палитры: 1 — сумрак (проявление), 2 — в свете; дальше — силуэт-пятно SHADE (не выдаёт, кто это)
const PXMAP = {
  wolf: [null, { k: PAL.night3, g: PAL.grey2, w: PAL.grey, r: PAL.blood, p: PAL.night3, e: PAL.red, i: PAL.night2, t: PAL.grey },
    { k: '#1c1e28', g: '#5a5e6c', w: PAL.bone, r: PAL.red, p: PAL.blood, e: PAL.orange, i: PAL.ink, t: PAL.cream }],
  alpha: [null, { k: PAL.grey2, g: PAL.grey, w: PAL.bone, r: PAL.blood, p: PAL.night3, e: PAL.gold, i: PAL.night2, t: PAL.grey },
    { k: '#5a5e6c', g: '#8a8e9c', w: PAL.cream, r: PAL.red, p: PAL.blood, e: PAL.gold, i: PAL.ink, t: PAL.cream }],
  sheep: [null, { c: PAL.grey, b: PAL.grey2, f: PAL.night1, p: PAL.grey2, y: PAL.grey, i: PAL.grey2, k: PAL.night1 },
    { c: PAL.cream, b: PAL.bone, f: '#2a2226', p: '#c07080', y: PAL.cream, i: '#c07080', k: PAL.ink }],
};
// силуэт по ступеням тумана: k — тело, d — дизер по краю
const PXSHADE = [{ k: PAL.night1, d: PAL.night3 }, { k: PAL.ink, d: PAL.night1 }, { k: PAL.ink, d: PAL.night1 }];
const PXHIT = Object.fromEntries([...'kgwrpietcbfy'].map(ch => [ch, PAL.cream]));


export function createWolves(app) {
  let N = null;
  const parts = new Particles(600);
  function segHit(ax, ay, bx, by, cx, cy, r) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = clamp(((cx - ax) * dx + (cy - ay) * dy) / l2, 0, 1); const px = ax + dx * t - cx, py = ay + dy * t - cy;
    return px * px + py * py < r * r;
  }
  function spawnWolf(kind) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const hp = kind === 'hound' ? 3 : kind === 'alpha' ? 2 : 1;
    const sp = (kind === 'hound' ? 150 : kind === 'alpha' ? 95 : 120) * N.def.speed * rand(0.85, 1.15);
    N.wolves.push({ x: side < 0 ? -50 : W + 50, y: rand(GROUND0 + 20, GROUND1), dir: -side, kind, hp, sp, t: rand(10), target: null, carry: null, hitT: 0, dead: false, flee: false, cut: -1 });
  }
  const scene = {
    get N() { return N; },
    enter(game, { id }) {
      const def = NIGHTS[id];
      N = { id, def, mode: def.mode || 'herd', t: 0, phase: 'intro', pt: 0, wolves: [], sheep: [], runners: [], trail: [], swipe: 0, kills: 0, broHits: 0, lost: 0, wave: 0, paused: false, result: null, floaters: [], shake: 0, timers: [],
        hearts: def.hearts || 3, collected: 0, spawnCd: 0.6,
        halves: [], bits: [], decals: [], rings: [], omens: [], recentX: [], hitstop: 0, slowT: 0, hurt: 0, broLost: 0, combos: 0, crits: 0, spawnIdx: 0, swipeKills: 0, swingCd: 0, swT: 0, swAng: 0, swordA: null, wasDown: false, ending: null, endReason: null,
        log: [], react: [], lastReact: 0, fogNow: 0.5, winNow: 1, puffs: Array.from({ length: 9 }, (_, i) => ({ x: i * 120 + rand(60), y: rand(HZ - 20, HZ + 100), s: rand(0.8, 1.6), v: rand(4, 14) * (i % 2 ? 1 : -1) })) };
      if (def.mode === 'toward') ZONE = def.revealU || 0.64;
      const nSheep = N.mode === 'herd' ? Math.max(3, Math.min(9, app.save.herd || 5)) : 0;
      for (let i = 0; i < nSheep; i++) N.sheep.push({ x: 480 + rand(-120, 120), y: rand(400, 470), hx: 0, t: rand(10), state: 'graze', vx: 0, carried: false, lost: false, scared: 0 });
      N.sheep.forEach(s => { s.hx = s.x; s.hy = s.y; });
      playMusic(null); setMood(N.mode === 'toward' ? 'wolves' : 'herd');
      setAmbient({ rain: 0, night: 0.45, howls: 0.25, fire: 0.35, wind: 0.1 });
    },
    update(dt, rdt = dt) {
      if (!N) return;
      const inp = app.inp, P = inp.pointer;
      if (inp.hit('Escape') && N.phase === 'fight') N.paused = !N.paused;
      if (N.paused) { inp.endStep(); return; }
      N.pt += dt; parts.update(dt, 520); N.shake = Math.max(0, N.shake - dt);
      for (const f of N.floaters) { f.t += dt; f.y -= 40 * dt; } N.floaters = N.floaters.filter(f => f.t < 1);
      if (N.phase === 'intro') { if (N.pt > 4.5 || (N.pt > 0.8 && P.pressed)) { N.phase = 'fight'; N.pt = 0; sfx('draw', { vol: 0.7 }); } inp.endStep(); return; }
      if (N.phase === 'result') { inp.endStep(); return; }
      if (N.mode === 'toward') { updToward(dt, rdt, P); inp.endStep(); return; }
      N.t += dt;
      // волны
      const W8 = N.def.waves;
      while (N.wave < W8.length && N.t >= W8[N.wave][0]) {
        const n = W8[N.wave][1];
        for (let i = 0; i < n; i++) setTimeout0(() => spawnWolf(N.def.hound && N.wave >= W8.length - 2 && i === 0 ? 'hound' : Math.random() < N.def.alpha ? 'alpha' : 'wolf'), i * 0.45);
        if (N.wave % 2 === 0) sfx(pick(['howl', 'growl']), { vol: 0.5, pan: rand(-0.6, 0.6) });
        N.wave++;
      }
      for (let i = N.timers.length - 1; i >= 0; i--) { N.timers[i].t -= dt; if (N.timers[i].t <= 0) { const f = N.timers[i].fn; N.timers.splice(i, 1); f(); } }
      // свайп
      if (P.down) {
        const last = N.trail[N.trail.length - 1];
        if (!last || Math.hypot(P.x - last.x, P.y - last.y) > 4) N.trail.push({ x: P.x, y: P.y, t: 0 });
        if (P.pressed) { N.swipe++; }
      }
      for (const q of N.trail) q.t += dt; N.trail = N.trail.filter(q => q.t < 0.18);
      const tr = N.trail;
      if (tr.length >= 2 && P.down) {
        const a = tr[tr.length - 2], b = tr[tr.length - 1], speed = Math.hypot(b.x - a.x, b.y - a.y) / dt;
        if (speed > 300) {
          if (!N.swingCd || N.swingCd <= 0) { sfx(pick(['swing', 'swing2']), { vol: 0.35 }); N.swingCd = 0.18; }
          for (const w of N.wolves) if (!w.dead && w.cut !== N.swipe && segHit(a.x, a.y, b.x, b.y, w.x, w.y - 18, w.kind === 'wolf' ? 34 : 42)) hitWolf(w);
          for (const s of N.sheep) if (!s.lost && !s.carried && s.scared <= 0 && s.cut !== N.swipe && segHit(a.x, a.y, b.x, b.y, s.x, s.y - 14, 18)) { s.cut = N.swipe; s.scared = 1.2; N.broHits++; sfx('miss', { vol: 0.5 }); N.floaters.push({ x: s.x, y: s.y - 40, s: 'Бро!', color: '#ffe0a8', t: 0 }); app.ach('bro'); }
        }
      }
      // тап по волку — тоже удар (для тех, кому неудобно свайпать)
      if (P.pressed) for (const w of N.wolves) if (!w.dead && Math.hypot(P.x - w.x, P.y - (w.y - 18)) < 36) { hitWolf(w); break; }
      N.swingCd = (N.swingCd || 0) - dt;

      // волки
      for (const w of N.wolves) {
        w.t += dt; w.hitT = Math.max(0, w.hitT - dt);
        if (w.dead) { w.deadT = (w.deadT || 0) + dt; continue; }
        if (w.flee) { w.x += w.dir * w.sp * 1.5 * dt; continue; }
        if (w.carry) { // тащит овцу к краю
          w.dir = w.x < 480 ? -1 : 1; w.x += w.dir * w.sp * 0.6 * dt; w.carry.x = w.x - w.dir * 22; w.carry.y = w.y;
          if (w.x < -60 || w.x > W + 60) { w.carry.lost = true; w.carry.carried = false; N.lost++; w.dead = true; w.gone = true; sfx('attack', { vol: 0.4 }); }
          continue;
        }
        if (!w.target || w.target.lost || w.target.carried) w.target = nearest(w);
        if (!w.target) { w.flee = true; continue; }
        const dx = w.target.x - w.x, dy = w.target.y - w.y, d = Math.hypot(dx, dy);
        w.dir = Math.sign(dx) || w.dir;
        if (d < 20) { w.carry = w.target; w.target.carried = true; sfx('attack', { vol: 0.6 }); N.shake = 0.2; }
        else { w.x += dx / d * w.sp * dt; w.y += dy / d * w.sp * dt * 0.6; }
      }
      N.wolves = N.wolves.filter(w => !(w.gone) && !(w.dead && w.deadT > 1.2) && !(w.flee && (w.x < -80 || w.x > W + 80)));
      // овцы
      for (const s of N.sheep) {
        if (s.lost || s.carried) continue;
        s.t += dt; s.scared = Math.max(0, s.scared - dt);
        const danger = N.wolves.find(w => !w.dead && !w.flee && Math.hypot(w.x - s.x, w.y - s.y) < 120);
        const tx = danger ? s.x - Math.sign(danger.x - s.x) * 40 : s.hx + Math.sin(s.t * 0.5) * 20;
        s.x += clamp(tx - s.x, -60 * dt, 60 * dt); s.x = clamp(s.x, 300, 660);
      }
      // конец ночи
      const alive = N.sheep.filter(s => !s.lost).length;
      if (N.mode === 'herd' && (N.t > N.def.dur && N.wolves.every(w => w.dead || w.flee)) || alive === 0) finish();
      else if (N.t > N.def.dur + 12) { for (const w of N.wolves) w.flee = true; }
      inp.endStep();
    },
    draw(ctx) { if (N) (N.mode === 'toward' ? drawToward : drawNight)(ctx); },
    toText: () => !N ? {} : N.mode === 'toward'
      ? { scene: 'wolves', id: N.id, mode: N.mode, phase: N.phase, t: +N.t.toFixed(1), hearts: N.hearts, collected: N.collected, kills: N.kills, broLost: N.broLost, combos: N.combos, crits: N.crits,
        runners: N.runners.filter(r => !r.dead).map(r => ({ x: Math.round(r.x), y: Math.round(r.y - r.jz), k: r.kind, u: +r.u.toFixed(2), zone: cuttable(r), lit: !!r.lit, since: r.lit ? +(N.t - r.litAt).toFixed(2) : -1, win: r.win ? +r.win.toFixed(2) : 0, hp: r.hp, hidden: !!r.hide, st: r.state })),
        omens: N.omens.length, halves: N.halves.length, ending: N.endReason, result: N.result, win: +N.winNow.toFixed(2), fog: +N.fogNow.toFixed(2),
        react: { n: N.react.length, last: +N.lastReact.toFixed(2), avg: N.react.length ? +(N.react.reduce((a, b) => a + b, 0) / N.react.length).toFixed(2) : 0, best: N.react.length ? +Math.min(...N.react).toFixed(2) : 0 } }
      : { scene: 'wolves', id: N.id, mode: N.mode, phase: N.phase, t: +N.t.toFixed(1), wolves: N.wolves.filter(w => !w.dead).map(w => ({ x: Math.round(w.x), y: Math.round(w.y), k: w.kind, hp: w.hp })), sheep: N.sheep.filter(s => !s.lost).length, kills: N.kills, lost: N.lost, result: N.result },
  };
  function setTimeout0(fn, t) { (N.timers ||= []).push({ fn, t }); }
  // ---- «Навстречу» v2: тренажёр реакции. Звери выходят из тумана ТЁМНЫМИ СИЛУЭТАМИ (волк и овца неразличимы), у кромки света
  // (u = litU) проявляются — и у игрока ~1 с (`win`) до прыжка волка/пробега овцы: волка — взмах, овцу — пропустить (в стадо).
  // Движение рваное: волк — замер/рывок/финт, овца — прыжки дугами; ритм подсказывает, но не решает (часть зверей «подражает»).
  function segD2(ax, ay, bx, by, cx, cy) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = clamp(((cx - ax) * dx + (cy - ay) * dy) / l2, 0, 1); const px = ax + dx * t - cx, py = ay + dy * t - cy;
    return px * px + py * py;
  }
  function dims(r) {
    const s = r.s * (r.kind === 'alpha' ? 1.15 : 1);
    if (STYLE.pixel) return [128 * s, (r.kind === 'sheep' ? 16 : 19) * 8 * s];
    return r.kind === 'sheep' ? [106 * s, 122 * s] : [98 * s, 142 * s];
  }
  const rate = (a, b, k) => lerp(a, b, k);
  // ---- профиль движения: список сегментов {d — длительность, f — доля пути, e — сглаживание, hop — высота прыжка, sq — сжатие/вытяжка, dx — финт вбок}.
  // Длительности и пути нормируются: профиль укладывается ровно в T секунд и dist глубины — окно решения выдерживается точно.
  const EASE = { o: t => 1 - (1 - t) ** 3, io: t => t * t * (3 - 2 * t), l: t => t };
  function mkProf(style, T, dist, o = {}) {
    const S = [], pz = o.pause ?? 1; let tot = 0, cum = 0;
    const add = g => { S.push(g); tot += g.d; };
    const feint = () => { let d = (Math.random() < 0.6 ? -Math.sign(cum || (Math.random() < 0.5 ? -1 : 1)) : (Math.random() < 0.5 ? -1 : 1)) * rand(0.09, 0.2); cum += d; return d; };
    while (tot < T && S.length < 44) {
      if (style === 'lunge') {
        add({ d: rand(0.12, 0.42) * pz, f: rand(0.02, 0.07), e: 'l', sq: -0.1, jit: 1 }); // замер, подёргивание
        if (Math.random() < 0.34 * (o.feint ?? 1)) add({ d: rand(0.13, 0.2), f: rand(0.02, 0.06), e: 'io', dx: feint(), sq: 0.04 }); // финт вбок
        add({ d: rand(0.12, 0.24), f: rand(0.9, 2.3), e: 'o', sq: 0.12 }); // рывок
        if (Math.random() < 0.22) add({ d: rand(0.1, 0.16), f: rand(0.5, 1), e: 'o', sq: 0.1 }); // второй рывок подряд
      } else if (style === 'hop') {
        add({ d: rand(0.06, 0.2) * pz, f: 0, e: 'l', sq: -0.08 });
        const dbl = Math.random() < 0.3;
        add({ d: rand(0.28, 0.4) * (dbl ? 0.75 : 1), f: rand(0.9, 1.5), e: 'io', hop: rand(0.6, 1) });
        if (dbl) add({ d: rand(0.2, 0.3), f: rand(0.5, 1), e: 'io', hop: rand(0.4, 0.7) }); // прыг-прыг
      } else { // «рысь»: ровнее, чуть подпрыгивает, иногда рывок
        add({ d: rand(0.22, 0.45), f: rand(0.7, 1.3), e: 'io', hop: rand(0.12, 0.28) });
        if (Math.random() < 0.3) add({ d: rand(0.1, 0.2), f: rand(0.8, 1.5), e: 'o', sq: 0.08 });
        if (Math.random() < 0.25 * (o.feint ?? 1)) add({ d: rand(0.13, 0.2), f: rand(0.05, 0.2), e: 'io', dx: feint() });
      }
    }
    while (S.length > 1 && S[S.length - 1].f < 0.1) { tot -= S.pop().d; }
    if (o.endBurst && !(S[S.length - 1].e === 'o' && S[S.length - 1].f > 0.8)) add({ d: rand(0.13, 0.22), f: rand(1, 1.8), e: 'o', sq: 0.12 });
    if (o.stall && S.length > 2) { const g = { d: rand(0.45, 0.9), f: 0, e: 'l', jit: 1 }; S.splice(1 + Math.floor(Math.random() * (S.length - 1)), 0, g); tot += g.d; } // остановка в тумане
    let sf = 0; for (const g of S) sf += g.f;
    const a = T / tot; let t = 0, u = 0, x = 0;
    for (const g of S) { g.d *= a; g.t0 = t; g.t1 = t += g.d; g.u0 = u; g.u1 = u += dist * g.f / sf; g.x0 = x; g.x1 = x += g.dx || 0; }
    return { S, T, dist };
  }
  function sampleProf(r, P, ts) {
    const S = P.S; let i = r.pi || 0; if (ts < S[i].t0) i = 0; while (i < S.length - 1 && ts >= S[i].t1) i++; r.pi = i;
    const g = S[i], tau = clamp((ts - g.t0) / g.d, 0, 1);
    r.u = (r.ub || 0) + g.u0 + (g.u1 - g.u0) * EASE[g.e](tau); // ub — глубина, с которой начат профиль
    r.dxP = (r.dxBase || 0) + g.x0 + (g.x1 - g.x0) * EASE.io(tau);
    r.hopK = g.hop ? g.hop * Math.sin(Math.PI * tau) : 0;
    r.sq = g.sq ? g.sq * Math.sin(Math.PI * tau) : 0;
    r.jit = g.jit ? Math.sin(r.t * 71 + (r.seed || 0)) * 0.011 : 0;
  }
  // стиль ритма: свой с вероятностью 1 − mimic, иначе — «подражание» чужому (подсказка не решает исход)
  function pickStyle(kind, mimic) {
    const own = kind === 'sheep' ? 'hop' : 'lunge';
    if (Math.random() >= mimic) return own;
    return own === 'hop' ? pick(['lunge', 'trot']) : pick(['hop', 'trot']);
  }
  function place(r) {
    if (r.Xb === undefined) r.Xb = r.X || 0;
    const dr = (r.dA || 0) * Math.sin(r.t * (r.dW || 1) + (r.dP || 0)) * (1 - sstep(0.88, 1, r.u));
    let X = clamp(r.Xb + (r.dxP || 0) + dr + (r.jit || 0) + (r.dashX || 0), -1.1, 1.1); r.X = X;
    if (r.kind !== 'sheep' && r.state === 'run') X *= 1 - 0.65 * sstep(0.86, 1, r.u); // волк в конце сворачивает на отца
    r.x = 480 + X * spread(r.u); r.y = gy(r.u); r.s = scl(r.u);
    r.jz = ((r.hopK || 0) * (r.ha || 30) + (r.dashJ || 0)) * r.s;
  }
  const cuttable = r => !r.dead && !r.hide && r.lit && ((r.state === 'run') || (r.state === 'lunge' && r.st < BITE));
  function pickLane() {
    let best = 0.5, bd = -1;
    for (let i = 0; i < 6; i++) { const X = (Math.random() < 0.5 ? -1 : 1) * rand(0.14, 0.88), d = Math.min(9, ...N.recentX.map(x => Math.abs(x - X))); if (d > bd) { bd = d; best = X; } }
    N.recentX.push(best); if (N.recentX.length > 3) N.recentX.shift(); return best;
  }
  function addRunner(kind, X, k, o = {}) {
    const D = N.def, T0 = rand(D.fogT[0], D.fogT[1]) * (kind === 'alpha' ? 1.08 : 1), style = pickStyle(kind, rate(D.mimic[0], D.mimic[1], k));
    const r = { kind, Xb: X, X, u: 0, hp: kind === 'alpha' ? 2 : 1, t: rand(10), seed: Math.floor(rand(1, 9999)), hitT: 0, cut: -1, state: 'run', st: 0, a: 1, jz: 0, zone: false, hide: null, dash: null, scar: null,
      style, lit: false, stage: 0, ts: 0, pi: 0, win: rate(D.win[0], D.win[1], k) * rand(0.93, 1.07), litU: litU(X), ha: rand(34, 54), hopK: 0, sq: 0, jit: 0, dxP: 0, dxBase: 0, lean: 0,
      dA: rand(0.04, 0.13), dW: rand(0.7, 2.1), dP: rand(TAU), ...o };
    if (!r.hide) r.prof = mkProf(style, T0, r.litU, { stall: Math.random() < rate(D.stall[0], D.stall[1], k), pause: kind === 'sheep' ? 1 : rate(1.2, 0.8, k) });
    sampleProf(r, r.prof || { S: [{ t0: 0, t1: 1, d: 1, u0: 0, u1: 0, x0: 0, x1: 0, e: 'l', f: 0 }] }, 0);
    place(r); N.runners.push(r); return r;
  }
  function spawnRunner(k) {
    const D = N.def, i = N.spawnIdx++, X = pickLane();
    const sheep = i === 1 || (i > 1 && Math.random() < D.sheep); // первые двое — волк и овца: игрок видит обоих
    if (sheep) {
      const s = addRunner('sheep', X, k);
      if (i > 3 && k > 0.15 && Math.random() < D.hide) { // волк прячется за овцой: в тумане сливается с ней
        addRunner('wolf', X, k, { hide: s, Xb: X, win: s.win * 0.8, prof: null }); }
      return;
    }
    // вожак: перед ним — вой и красные глаза в тумане (в случайной полосе, сам придёт в другой)
    if (i > 3 && N.t < D.dur - 4 && Math.random() < D.alpha * (0.5 + k)) { N.omens.push({ X: (Math.random() < 0.5 ? -1 : 1) * rand(0.2, 0.8), X2: X, t: 0 }); sfx('howl', { vol: 0.45, pan: X * 0.8 }); return; }
    addRunner('wolf', X, k);
  }
  // свет коснулся зверя — проявляется, у игрока окно r.win до прыжка/пробега; профиль последнего отрезка пути
  function goLit(r) {
    const end = r.kind === 'sheep' ? 0.97 : 1;
    r.lit = true; r.litAt = N.t; r.stage = 1; r.ts = 0; r.pi = 0; r.dxBase = r.dxP || 0; r.ub = r.u;
    r.prof = mkProf(r.style, r.win, Math.max(0.05, end - r.u), { endBurst: r.kind !== 'sheep', pause: 0.8, feint: 0.5 });
    r.revealT = 0; N.rings.push({ x: r.x, y: r.y, s: r.s, t: 0 });
    if (r.kind === 'sheep') sfx('harp1', { vol: 0.12, rate: 1.5, pan: r.X * 0.8 }); else sfx('growl', { vol: 0.2, pan: r.X * 0.8, rate: 1.2 });
  }
  // волк, прятавшийся за овцой, выскакивает вбок (к отцу): сразу виден, окно короче
  function revealHidden(s) {
    for (const r of N.runners) if (r.hide === s && !r.dead) {
      r.hide = null; r.u = Math.max(r.u, s.u - 0.03); r.Xb = r.X; r.dxP = 0; r.dxBase = 0; r.dA = 0; const dir = s.X > 0 ? -1 : 1;
      r.dash = { t: 0, d: dir * 0.42 }; r.style = 'lunge'; goLit(r); r.prof = mkProf('lunge', r.win, 1 - r.u, { endBurst: true, pause: 0.5, feint: 0 }); r.win = r.prof.T;
      sfx('growl', { vol: 0.55 }); place(r); N.floaters.push({ x: r.x, y: r.y - dims(r)[1] - 8, s: 'Из-за овцы!', color: '#ff9a7a', t: 0 });
    }
  }
  function updToward(dt, rdt, P) {
    const D = N.def;
    N.hurt = Math.max(0, N.hurt - rdt * 1.6);
    for (const g of N.rings) g.t += rdt; N.rings = N.rings.filter(g => g.t < 0.5);
    // мир: хитстоп и замедление; клинок — по реальному времени
    let w = dt;
    if (N.hitstop > 0) { N.hitstop -= rdt; w = 0; }
    else if (N.ending) w = dt * 0.25;
    else if (N.slowT > 0) { N.slowT -= rdt; w = dt * 0.45; }
    if (!N.ending) blade(P, rdt);
    else { for (const q of N.trail) q.t += rdt; N.trail = N.trail.filter(q => q.t < 0.2); }
    N.swT = Math.max(0, N.swT - rdt);
    N.t += w;
    const k = clamp(N.t / D.dur, 0, 1);
    N.fogNow = rate(D.fog[0], D.fog[1], k); N.winNow = rate(D.win[0], D.win[1], k);
    if (!N.ending && N.t < D.dur) {
      N.spawnCd -= w;
      if (N.spawnCd <= 0) { N.spawnCd = lerp(D.iv[0], D.iv[1], k) * rand(0.8, 1.2); spawnRunner(k); if (Math.random() < lerp(D.dbl[0], D.dbl[1], k)) spawnRunner(k); }
    }
    for (const o of N.omens) { o.t += w; if (o.t >= 1.1) { o.done = true; addRunner('alpha', o.X2, k); sfx('snarl', { vol: 0.35, pan: o.X2 * 0.8 }); } }
    N.omens = N.omens.filter(o => !o.done);
    for (const r of N.runners) if (!r.dead) stepRunner(r, w, D);
    N.runners = N.runners.filter(r => !r.gone && !r.dead);
    stepFx(w);
    for (const p of N.puffs) { p.x += p.v * w; if (p.x > W + 200) p.x = -200; if (p.x < -200) p.x = W + 200; }
    if (N.ending) { N.ending.t += rdt; if (N.ending.t > 1.5) finishToward(); }
    else if (N.hearts <= 0) endNight('bite');
    else if (N.broLost >= D.broMax) endNight('bro');
    else if (N.t > D.dur && !N.runners.length && !N.omens.length) finishToward();
  }
  function endNight(reason) { N.ending = { t: 0, reason }; N.endReason = reason; N.trail = []; sfx(reason === 'bite' ? 'howl' : 'miss', { vol: 0.6 }); }
  // журнал решений: что было (волк/овца), за сколько с проявления, чем кончилось — для тренажёра и ботов
  function logEv(r, res, dt) { N.log.push({ k: r.kind === 'sheep' ? 'sheep' : 'wolf', res, dt: +dt.toFixed(3), win: +(r.win || 0).toFixed(2), t: +N.t.toFixed(2) }); }
  function stepRunner(r, w, D) {
    r.t += w; r.hitT = Math.max(0, r.hitT - w); r.revealT = (r.revealT || 0) + w;
    const px0 = r.x;
    if (r.hide) {
      const s = r.hide;
      if (s.dead || s.gone || s.state !== 'run' || s.lit) { revealHidden(s); if (r.hide) r.hide = null; }
      else { r.u = s.u - 0.03; r.Xb = s.Xb + (s.X > 0 ? 0.035 : -0.035); r.dxP = s.dxP; r.hopK = s.hopK * 0.9; r.sq = s.sq; r.jit = s.jit; r.dA = s.dA; r.dW = s.dW; r.dP = s.dP; r.ha = s.ha; place(r); return; }
    }
    if (r.dash) { r.dash.t += w; const p = Math.min(1, r.dash.t / 0.28); r.dashX = r.dash.d * sstep(0, 1, p); r.dashJ = Math.sin(p * Math.PI) * 22; if (p >= 1) { r.dash = null; r.dashJ = 0; } }
    if (r.state === 'run') {
      r.ts += w;
      if (r.prof) { sampleProf(r, r.prof, r.ts); if (!r.lit && r.ts >= r.prof.T) { r.u = r.litU; goLit(r); } else if (r.lit && r.ts >= r.prof.T) r.u = Math.max(r.u, r.kind === 'sheep' ? 0.97 : 1); }
      else { r.u += (r.v || 0) * w; if (!r.lit && r.u >= litU(r.Xb || 0)) { r.lit = true; r.litAt = N.t; r.win = r.win || N.winNow; } } // запасной путь: зверь без профиля (тесты)
      place(r);
      if (!r.zone && r.lit) { r.zone = true; }
      if (r.kind === 'sheep' && r.u >= 0.97) {
        r.state = 'pass'; r.st = 0; N.collected++; sfx('harp1', { vol: 0.22, rate: 1.2 }); logEv(r, 'pass', N.t - (r.litAt ?? N.t));
        N.floaters.push({ x: r.x, y: r.y - dims(r)[1], s: '+1 овца', color: '#e8f0d8', t: 0 });
      } else if (r.kind !== 'sheep' && r.u >= 1) { r.state = 'lunge'; r.st = 0; r.x0 = r.x; r.y0 = r.y; r.s0 = r.s; sfx('snarl', { vol: 0.6 }); }
    } else if (r.state === 'pass') { // овца пробегает мимо отца в стадо
      r.st += w; r.u += 0.5 * w; r.Xb += Math.sign(r.X || 1) * 2.4 * w; r.hopK = 0; place(r); r.a = 1 - r.st / 0.6; if (r.st > 0.6) r.gone = true;
    } else if (r.state === 'lunge') { // прыжок на отца: последний шанс — пока не укусил
      r.st += w; const p = Math.min(1, r.st / 0.3); r.sq = 0.1 * (1 - p);
      r.x = lerp(r.x0, 480, p * 0.75); r.y = lerp(r.y0, 600, p); r.jz = Math.sin(p * Math.PI) * 110 * r.s0; r.s = r.s0 * (1 + p * 0.9);
      if (!r.bit && r.st >= BITE) {
        r.bit = true; N.hearts = Math.max(0, N.hearts - 1); N.hurt = 1; N.shake = 0.45; N.hitstop = 0.07; logEv(r, 'bite', r.win || 0);
        sfx('attack', { vol: 0.6 }); N.floaters.push({ x: 480, y: 360, s: 'Укус!', color: '#ff7a60', t: 0 });
      }
      if (p >= 1) { r.state = 'flee'; r.st = 0; }
    } else if (r.state === 'flee') { r.st += w; r.a = 1 - r.st / 0.35; r.y += 200 * w; if (r.st > 0.35) r.gone = true; }
    if (w > 0 && r.state === 'run') r.lean = lerp(r.lean || 0, clamp((r.x - px0) / w / (900 * r.s + 120), -0.3, 0.3), 0.3);
  }
  // ---- клинок: след указателя (мышь/тач), отрезок за шаг ≥ 6 ед. — это взмах (тап не рубит, как в Slice)
  function blade(P, rdt) {
    for (const q of N.trail) q.t += rdt; N.trail = N.trail.filter(q => q.t < 0.2);
    if (P.down) {
      const last = N.trail[N.trail.length - 1];
      if (P.pressed || !N.wasDown || !last) { N.swipe++; N.swipeKills = 0; N.trail.push({ x: P.x, y: P.y, t: 0 }); }
      else { const d = Math.hypot(P.x - last.x, P.y - last.y); if (d >= 3) { N.trail.push({ x: P.x, y: P.y, t: 0 }); if (d >= 6) cutSeg(last.x, last.y, P.x, P.y, d); } }
    }
    N.wasDown = P.down; N.swingCd -= rdt;
  }
  function cutSeg(ax, ay, bx, by, d) {
    const ang = Math.atan2(by - ay, bx - ax);
    N.swAng = ang; N.swT = 0.22;
    if (d > 14 && N.swingCd <= 0) { sfx(pick(['swing', 'swing2']), { vol: 0.3 }); N.swingCd = 0.16; }
    const order = [...N.runners].sort((a, b) => b.u - a.u);
    for (const r of order) {
      if (r.cut === N.swipe || !cuttable(r)) continue;
      const [w, h] = dims(r), sh = r.kind === 'sheep', cy = r.y - h * 0.5 - r.jz, rx = w * (sh ? 0.34 : 0.5), ry = h * (sh ? 0.36 : 0.48); // овце — сомнение в пользу игрока
      const d2 = segD2(ax / rx, ay / ry, bx / rx, by / ry, r.x / rx, cy / ry);
      if (d2 < 1) strike(r, ang, d2 < 0.03);
    }
  }
  function strike(r, ang, crit) {
    r.cut = N.swipe;
    const [w, h] = dims(r), cx = r.x, cy = r.y - h * 0.5 - r.jz;
    N.bits.push({ k: 'slash', x: cx, y: cy, ang, len: Math.max(w, h) * 1.4, t: 0, life: 0.16 });
    if (r.kind === 'sheep') { // своя овца: «Бро!» — штраф
      r.dead = true; split(r, ang); N.broLost++; logEv(r, 'bro', N.t - (r.litAt ?? N.t));
      burst(cx, cy, r.y, 'wool', 18, r.s); burst(cx, cy, r.y, 'drop', 8, r.s, ang); addDecal(cx, r.y + 2, 16 * r.s + 6);
      N.hitstop = 0.06; N.shake = 0.22; N.hurt = Math.max(N.hurt, 0.35);
      sfx('miss', { vol: 0.55 }); sfx('harp1', { vol: 0.3, rate: 0.55 });
      N.floaters.push({ x: cx, y: cy - h * 0.5, s: 'Бро!', color: '#ffe0a8', t: 0 }); app.ach('bro');
      revealHidden(r); return;
    }
    r.hp--;
    if (r.hp > 0) { // вожак: первый удар — отшатнулся, шрам
      r.hitT = 0.3; r.ts = Math.max(0, r.ts - 0.3); r.pi = 0; r.scar = ang; if (r.prof) sampleProf(r, r.prof, r.ts); place(r);
      burst(cx, cy, r.y, 'fur', 12, r.s, ang); burst(cx, cy, r.y, 'drop', 8, r.s, ang);
      N.hitstop = 0.05; N.shake = 0.14; sfx('blade', { vol: 0.55 }); sfx('snarl', { vol: 0.4 }); return;
    }
    r.dead = true; split(r, ang); N.kills++; N.swipeKills++;
    const rt = N.t - (r.litAt ?? N.t); N.react.push(rt); N.lastReact = rt; logEv(r, 'kill', rt); // время с проявления до удара
    const sr = (app.save.stats.wolfReact ||= { n: 0, sum: 0, best: 9 }); sr.n++; sr.sum += rt; sr.best = Math.min(sr.best, rt);
    burst(cx, cy, r.y, 'drop', crit ? 28 : 18, r.s, ang); burst(cx, cy, r.y, 'fur', 10, r.s, ang); addDecal(cx, r.y + 2, 26 * r.s + 10);
    N.hitstop = r.kind === 'alpha' ? 0.1 : crit ? 0.08 : 0.055; N.shake = r.kind === 'alpha' ? 0.3 : 0.18;
    sfx('slash', { vol: 0.6 }); sfx('blade', { vol: 0.3, rate: 1.3 }); sfx('growl', { vol: 0.25, rate: 1.7 });
    if (crit) { N.crits++; N.floaters.push({ x: cx, y: cy - h * 0.55, s: 'Точно!', color: '#ffd27a', t: 0 }); }
    else if (Math.random() < 0.2) N.floaters.push({ x: cx, y: cy - h * 0.55, s: 'Небро!', color: '#ff8a70', t: 0 });
    N.floaters.push({ x: cx, y: cy + h * 0.3, s: rt.toFixed(2).replace('.', ',') + (LANG.v === 'en' ? ' s' : ' с'), color: rt < 0.45 ? '#b8f0a0' : rt < 0.75 ? '#ffe08a' : '#ffb090', t: 0, small: 1 });
    if (N.swipeKills >= 2) { // несколько волков одним взмахом
      N.combos++; const s = N.swipeKills === 2 ? 'Двойной удар!' : N.swipeKills === 3 ? 'Тройной удар!' : `Удар ×${N.swipeKills}!`;
      N.floaters.push({ x: cx, y: cy - h * 0.85, s, color: '#ffb070', t: 0 }); sfx('blade', { vol: 0.35, rate: 1.7 });
    }
  }
  // ---- половинки: снимок зверя режется по линии взмаха, края — мясо; летят в стороны поперёк взмаха, крутятся, падают
  function split(r, ang) {
    const [w, h] = dims(r), cw = Math.ceil(Math.max(w, h) * 1.25) + 8, ch = cw;
    const snap = document.createElement('canvas'); snap.width = cw; snap.height = ch; const x = snap.getContext('2d'); x.imageSmoothingEnabled = false;
    drawRunner(x, { ...r, x: cw / 2, y: ch / 2 + h / 2, jz: 0, hitT: 0, a: 1, sq: 0, lean: 0 }, { snap: true });
    const cx = r.x, cy = r.y - h / 2 - r.jz, thick = Math.max(2.5, 4.5 * r.s);
    for (const side of [-1, 1]) {
      const a = ang + side * Math.PI / 2, f = rand(160, 260) * (0.5 + r.s * 0.6), hc = halfCanvas(snap, ang, side, thick);
      N.halves.push({ c: hc[0], wc: hc[1], x: cx, y: cy, vx: Math.cos(a) * f + rand(-20, 20), vy: Math.sin(a) * f - rand(60, 140), rot: 0, vr: side * rand(4, 8),
        gy: Math.max(cy, r.y - h * 0.15) + rand(-4, 8), t: 0, flash: 1, rest: 0 });
    }
  }
  function halfCanvas(snap, ang, side, thick) {
    const cw = snap.width, ch = snap.height, R = cw + ch;
    const mk = () => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
    const [c, x] = mk();
    x.translate(cw / 2, ch / 2); x.rotate(ang); x.beginPath(); x.rect(-R, side < 0 ? -R : 0, 2 * R, R); x.setTransform(1, 0, 0, 1, 0, 0); x.clip();
    x.drawImage(snap, 0, 0);
    x.globalCompositeOperation = 'source-atop'; x.translate(cw / 2, ch / 2); x.rotate(ang);
    if (STYLE.pixel) thick = Math.max(4, Math.round(thick / 4) * 4);
    x.fillStyle = '#4e080c'; x.fillRect(-R, side < 0 ? -thick : 0, 2 * R, thick);
    x.fillStyle = '#a3252a'; x.fillRect(-R, side < 0 ? -thick * 0.4 : 0, 2 * R, thick * 0.4);
    const [c2, x2] = mk(); x2.drawImage(c, 0, 0); x2.globalCompositeOperation = 'source-atop'; x2.fillStyle = '#fff8ee'; x2.fillRect(0, 0, cw, ch);
    return [c, c2];
  }
  function burst(x, y, g, kind, n, s, ang = 0) {
    for (let i = 0; i < n && N.bits.length < 420; i++) {
      const a = kind === 'wool' ? rand(TAU) : ang + (Math.random() < 0.5 ? 0 : Math.PI) + rand(-0.8, 0.8), sp = rand(80, 320) * (0.5 + s * 0.6);
      N.bits.push({ k: kind, x: x + rand(-8, 8) * s, y: y + rand(-10, 10) * s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'drop' ? rand(40, 160) : 0), gy: g + rand(-6, 14),
        t: 0, life: kind === 'wool' ? rand(0.5, 1) : rand(0.6, 1.4), sz: (kind === 'wool' ? rand(6, 14) : rand(2, 4.5)) * (0.6 + s * 0.5), rot: rand(TAU) });
    }
  }
  function addDecal(x, y, r) { N.decals.push({ x, y, r, t: 0, seed: Math.random() * 99 }); if (N.decals.length > 70) N.decals.shift(); }
  function stepFx(w) {
    for (const b of N.bits) {
      b.t += w; if (b.k === 'slash') continue;
      if (b.k === 'wool') { b.vx *= 1 - 3 * w; b.vy = b.vy * (1 - 3 * w) - 30 * w; }
      else { b.vy += (b.k === 'fur' ? 380 : 900) * w; if (b.k === 'fur') b.vx *= 1 - 2 * w; }
      b.x += b.vx * w; b.y += b.vy * w; b.rot += w * 6;
      if (b.k === 'drop' && b.vy > 0 && b.y >= b.gy) { b.t = b.life; addDecal(b.x, b.gy, b.sz * 1.6); }
    }
    N.bits = N.bits.filter(b => b.t < b.life);
    for (const h of N.halves) {
      h.t += w; h.flash = Math.max(0, h.flash - w * 4);
      if (h.rest) { h.rest += w; continue; }
      h.vy += 1000 * w; h.vx *= 1 - 0.8 * w; h.vr *= 1 - 1.5 * w;
      h.x += h.vx * w; h.y += h.vy * w; h.rot += h.vr * w;
      if (w > 0 && h.t < 0.6 && Math.random() < 0.1 && N.bits.length < 420) N.bits.push({ k: 'drop', x: h.x + rand(-10, 10), y: h.y + rand(-10, 10), vx: h.vx * 0.3 + rand(-60, 60), vy: rand(-60, 20), gy: h.gy + 6, t: 0, life: 1, sz: rand(1.5, 3), rot: 0 });
      if (h.y >= h.gy && h.vy > 0) { if (h.vy > 260) { h.vy *= -0.28; h.vx *= 0.5; h.vr *= 0.4; addDecal(h.x, h.gy + 6, 8); } else { h.y = h.gy; h.rest = 0.001; } }
    }
    N.halves = N.halves.filter(h => h.rest < 1.6 && h.y < H + 200);
    for (const d of N.decals) d.t += w;
    N.decals = N.decals.filter(d => d.t < 14);
  }
  function finishToward() {
    if (N.phase === 'result') return;
    N.phase = 'result'; N.pt = 0;
    const herd = Math.max(3, Math.min(9, N.collected)); app.save.herd = herd;
    const quick = N.react.filter(t => t < 0.5).length, gifts = Math.floor(N.kills / 8), shards = Math.floor(N.kills / 2) + N.collected + N.combos + Math.floor(N.crits / 3) + Math.floor(quick / 6); // быстрые удары (<0,5 с) — бонус
    for (let i = 0; i < gifts; i++) app.save.gifts[pick(['gaze', 'flash', 'amph'])]++;
    app.save.stats.wolves += N.kills; app.save.shards = (app.save.shards || 0) + shards;
    if (app.save.stats.wolves >= 60) app.ach('wolfbane');
    app.persist(); sfx('sacred', { vol: 0.4 });
    const ra = N.react.length ? N.react.reduce((a, b) => a + b, 0) / N.react.length : 0;
    N.result = { toward: true, collected: N.collected, kills: N.kills, herd, gifts, shards, hearts: N.hearts, broLost: N.broLost, combos: N.combos, reason: N.endReason || 'dawn', reactAvg: ra, reactBest: N.react.length ? Math.min(...N.react) : 0, quick };
  }

  // ---- отрисовка «навстречу»
  function drawToward(ctx) {
    const inp = app.inp, px = STYLE.pixel;
    ctx.save();
    if (N.shake > 0) ctx.translate(Math.round(Math.sin(N.pt * 90) * N.shake * 10), Math.round(Math.cos(N.pt * 70) * N.shake * 6));
    drawCam(ctx, img('bg_valley'), [0.5, 0.5, 1.05]);
    if (px) { const top = HZ / 4 | 0, g = pxGroundPlane(top); ctx.drawImage(g, 0, top * 4, W, g.height * 4); }
    else {
      ctx.fillStyle = 'rgba(6,4,10,0.35)'; ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, HZ, 0, H); g.addColorStop(0, 'rgba(14,10,14,0.2)'); g.addColorStop(1, 'rgba(8,5,6,0.92)'); ctx.fillStyle = g; ctx.fillRect(0, HZ, W, H - HZ);
    }
    drawPool(ctx);
    // знак вожака: вой и красные глаза в тумане (в случайной полосе — сам вожак придёт в другой)
    for (const o of N.omens) { if (Math.floor(o.t * 6) % 3 === 2) continue; const x = 480 + o.X * spread(0.06), y = gy(0.06) - 7; ctx.fillStyle = px ? PAL.red : '#ff4a20'; for (const sd of [-1, 1]) ctx.fillRect(Math.round(x + sd * 3 - 1), Math.round(y), px ? 2 : 2.5, 2); }
    const ents = N.runners.filter(r => !r.dead).sort((a, b) => a.u - b.u);
    const dim = ents.filter(r => !r.lit), lit = ents.filter(r => r.lit); // dim — тёмные силуэты в тумане, lit — проявленные на свету
    for (const r of dim) drawRunner(ctx, r);
    drawFogBank(ctx);
    drawZone(ctx, lit.some(r => cuttable(r)));
    drawDecals(ctx);
    for (const r of lit) if (r.state === 'run') drawRunner(ctx, r);
    drawFatherBack(ctx);
    for (const r of lit) if (r.state !== 'run') drawRunner(ctx, r);
    for (const h of N.halves) drawHalf(ctx, h);
    drawBits(ctx);
    drawBlade(ctx);
    ctx.restore();
    if (N.hurt > 0) { // укус: красная кромка
      if (px) { ctx.fillStyle = PAL.red; ctx.globalAlpha = N.hurt * 0.6; ctx.fillRect(0, 0, W, 16); ctx.fillRect(0, H - 16, W, 16); ctx.fillRect(0, 0, 16, H); ctx.fillRect(W - 16, 0, 16, H); ctx.globalAlpha = 1; }
      else { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9); g.addColorStop(0, 'rgba(160,10,10,0)'); g.addColorStop(1, `rgba(160,10,10,${0.6 * N.hurt})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    }
    for (const f of N.floaters) text(ctx, f.s, f.x, f.y, { size: f.small ? 17 : 24, color: f.color, weight: 700, stroke: 3, sc: true });
    hudToward(ctx);
    const left = Math.max(0, N.def.dur - N.t);
    text(ctx, N.phase === 'fight' ? (left > 0 ? `До рассвета ${Math.ceil(left)} с` : 'Рассвет близко…') : '', W / 2, 32, { size: 20, sc: true, color: '#e8d2b8' });
    if (N.phase === 'fight' && pauseButton(ctx, inp, 908, 12)) N.paused = true;
    if (N.phase === 'intro') {
      const a = Math.min(1, N.pt * 2, (4.5 - N.pt) * 2);
      ctx.globalAlpha = Math.max(0, a); comicBox(ctx, W / 2 - 300, 140, 600, 170);
      text(ctx, 'Ночь волков', W / 2, 175, { size: 30, sc: true });
      text(ctx, 'Из тумана бегут тени. Кто это — станет видно на свету.', W / 2, 216, { size: 18 });
      text(ctx, 'Волк — удар взмахом, овца — пропусти в стадо. Времени мало.', W / 2, 244, { size: 18, color: '#ffe0a8' });
      text(ctx, 'Вожаку нужно два удара. Волк может прятаться за овцой.', W / 2, 272, { size: 16, color: '#c9b8a6' });
      ctx.globalAlpha = 1;
    }
    if (N.ending) { ctx.fillStyle = `rgba(4,2,3,${Math.min(0.7, N.ending.t * 0.5)})`; ctx.fillRect(0, 0, W, H); }
    if (N.phase === 'result') drawResult(ctx, inp);
    drawPost(ctx, { tint: '#2a2a5a', tintA: 0.14 });
    if (N.paused) { const r = drawPause(ctx, inp, app.save.settings.sfx > 0); if (r === 'resume') N.paused = false; else if (r === 'sound') app.toggleSound(); else if (r === 'menu') { N.paused = false; app.goMenu(); } }
  }
  // туман: полоса у горизонта, поле плотнее дальше от света и дрейфующие клочья (звери проходят сквозь них); густота N.fogNow растёт за ночь
  function drawFogBank(ctx) {
    const fk = N.fogNow / 0.7, y1 = gy(ZONE) + 4;
    if (STYLE.pixel) {
      const top = Math.floor((HZ - 30) / 4), rows = Math.ceil((y1 - HZ + 30) / 4);
      for (const [col, seed, sp, dens] of [[PAL.grey2, 5, 2, Math.round(5 + 9 * N.fogNow)], [PAL.night3, 11, -3, Math.round(3 + 6 * N.fogNow)]]) {
        const c = pxFogField(240, rows, col, seed, dens), off = ((Math.floor(N.pt * sp) % 240) + 240) % 240;
        ctx.drawImage(c, -off * 4, top * 4, 960, rows * 4); ctx.drawImage(c, (240 - off) * 4, top * 4, 960, rows * 4);
      }
      for (const [col, seed, y, hh, sp] of [[PAL.grey2, 3, HZ - 44, 24, 3], [PAL.night3, 8, HZ - 8, 16, -5]]) {
        const c = pxFogBank(240, hh, col, seed, 8), off = ((Math.floor(N.pt * sp) % 240) + 240) % 240;
        ctx.drawImage(c, -off * 4, y, 960, hh * 4); ctx.drawImage(c, (240 - off) * 4, y, 960, hh * 4);
      }
      return;
    }
    const g = ctx.createLinearGradient(0, HZ - 70, 0, y1); g.addColorStop(0, 'rgba(106,110,126,0)'); g.addColorStop(0.3, `rgba(106,110,126,${0.4 * fk})`); g.addColorStop(0.72, `rgba(106,110,126,${0.2 * fk})`); g.addColorStop(1, 'rgba(106,110,126,0)');
    ctx.fillStyle = g; ctx.fillRect(0, HZ - 70, W, y1 - HZ + 70);
    ctx.save(); ctx.scale(1, 0.34);
    for (const p of N.puffs) {
      const x = p.x, y = (p.y + Math.sin(N.pt * 0.4 + p.x) * 6) / 0.34, R = 120 * p.s;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, R); rg.addColorStop(0, `rgba(134,138,154,${0.3 * fk})`); rg.addColorStop(1, 'rgba(134,138,154,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    }
    ctx.restore();
  }
  // пятно света факела на земле (граница — арка проявления)
  function drawPool(ctx) {
    const fl = 0.9 + 0.1 * Math.sin(N.pt * 9.3) + 0.04 * Math.sin(N.pt * 23);
    if (STYLE.pixel) {
      const tops = Array.from({ length: 240 }, (_, a) => arcY(a * 4 + 2) / 4);
      ctx.drawImage(pxLightPool(tops, 'z' + ZONE), 0, 0, W, H); return;
    }
    ctx.save(); ctx.translate(440, 560); ctx.scale(1, 0.25);
    const rg = ctx.createRadialGradient(0, 0, 30, 0, 0, 640); rg.addColorStop(0, `rgba(255,170,90,${0.36 * fl})`); rg.addColorStop(0.55, `rgba(255,130,60,${0.15 * fl})`); rg.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 640, 0, TAU); ctx.fill(); ctx.restore();
  }
  // кромка круга света: здесь зверь проявляется
  function drawZone(ctx, hot) {
    const pulse = 0.5 + 0.5 * Math.sin(N.pt * 5);
    if (STYLE.pixel) {
      for (let x = 24; x < W - 16; x += 16) { const y = Math.round(arcY(x) / 4) * 4; ctx.fillStyle = hot ? PAL.fire : (x / 16) % 2 ? PAL.orange : PAL.brown2; ctx.fillRect(x, y, 8, 4); }
      for (const g of N.rings) { const k = g.t / 0.5, rx = (20 + 70 * k) * (0.5 + g.s); ctx.fillStyle = PAL.cream; ctx.globalAlpha = 1 - k; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.fillRect(Math.round((g.x + Math.cos(a) * rx) / 4) * 4, Math.round((g.y + Math.sin(a) * rx * 0.25) / 4) * 4, 4, 4); } ctx.globalAlpha = 1; }
      return;
    }
    ctx.save(); ctx.strokeStyle = `rgba(255,${hot ? 210 : 180},${hot ? 150 : 110},${hot ? 0.5 + 0.2 * pulse : 0.2 + 0.08 * pulse})`; ctx.lineWidth = hot ? 2.2 : 1.4; ctx.setLineDash([10, 8]);
    ctx.beginPath(); for (let x = 20; x <= W - 20; x += 20) x === 20 ? ctx.moveTo(x, arcY(x)) : ctx.lineTo(x, arcY(x)); ctx.stroke(); ctx.setLineDash([]);
    for (const g of N.rings) { const k = g.t / 0.5; ctx.strokeStyle = `rgba(255,220,170,${0.7 * (1 - k)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(g.x, g.y, (20 + 70 * k) * (0.5 + g.s), (5 + 16 * k) * (0.5 + g.s), 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  function drawDecals(ctx) {
    for (const d of N.decals) {
      const a = Math.min(1, (14 - d.t) / 3);
      if (STYLE.pixel) { ctx.fillStyle = PAL.blood; ctx.globalAlpha = a; for (let j = 0; j < 4; j++) ctx.fillRect(Math.round((d.x + Math.cos(d.seed + j * 2.1) * d.r * 0.6) / 4) * 4, Math.round((d.y + Math.sin(d.seed + j * 1.7) * d.r * 0.15) / 4) * 4, d.r > 12 ? 8 : 4, 4); ctx.globalAlpha = 1; continue; }
      ctx.fillStyle = `rgba(88,6,10,${0.75 * a})`;
      for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(d.x + Math.cos(d.seed + j * 2.1) * d.r * 0.5, d.y + Math.sin(d.seed + j * 1.7) * d.r * 0.12, d.r * (0.45 + 0.25 * Math.abs(Math.sin(d.seed * (j + 1)))), d.r * 0.16, 0, 0, TAU); ctx.fill(); }
    }
  }
  function drawHalf(ctx, h) {
    const a = h.rest ? Math.max(0, 1 - Math.max(0, h.rest - 0.9) / 0.7) : 1, rot = STYLE.pixel ? Math.round(h.rot / (Math.PI / 8)) * (Math.PI / 8) : h.rot;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(Math.round(h.x), Math.round(h.y)); ctx.rotate(rot);
    ctx.drawImage(h.c, -h.c.width / 2, -h.c.height / 2);
    if (h.flash > 0) { ctx.globalAlpha = a * h.flash * 0.9; ctx.drawImage(h.wc, -h.c.width / 2, -h.c.height / 2); }
    ctx.restore();
  }
  function drawBits(ctx) {
    const px = STYLE.pixel, sn = v => Math.round(v / 4) * 4;
    for (const b of N.bits) {
      const k = b.t / b.life;
      if (b.k === 'slash') { // белая вспышка разреза
        const c = Math.cos(b.ang) * b.len / 2, s = Math.sin(b.ang) * b.len / 2;
        if (px) { pxLine(ctx, b.x - c, b.y - s, b.x + c, b.y + s, 4, PAL.cream); continue; }
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,245,230,${1 - k})`; ctx.lineWidth = 7 * (1 - k) + 1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(b.x - c, b.y - s); ctx.lineTo(b.x + c, b.y + s); ctx.stroke(); ctx.restore(); continue;
      }
      ctx.globalAlpha = b.k === 'wool' ? 1 - k : Math.min(1, (1 - k) * 2);
      if (px) { ctx.fillStyle = b.k === 'drop' ? (b.sz > 3 ? PAL.red : PAL.blood) : b.k === 'fur' ? PAL.grey2 : (k < 0.5 ? PAL.cream : PAL.bone); const z = b.k === 'wool' ? 8 : 4; ctx.fillRect(sn(b.x), sn(b.y), z, z); continue; }
      if (b.k === 'drop') { ctx.fillStyle = b.sz > 3 ? '#8a0e14' : '#5a0a0c'; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2); const s = b.sz; ctx.beginPath(); ctx.moveTo(0, -s * 1.8); ctx.quadraticCurveTo(s, 0, 0, s); ctx.quadraticCurveTo(-s, 0, 0, -s * 1.8); ctx.fill(); ctx.restore(); }
      else if (b.k === 'fur') { ctx.fillStyle = '#2a2830'; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillRect(-b.sz, -b.sz / 3, b.sz * 2, b.sz * 0.7); ctx.restore(); }
      else { ctx.fillStyle = '#e6ddd2'; ctx.beginPath(); ctx.arc(b.x, b.y, b.sz * (1 + k), 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  function drawBlade(ctx) {
    const tr = N.trail; if (tr.length < 2) return;
    if (STYLE.pixel) { for (let i = 1; i < tr.length; i++) pxLine(ctx, tr[i - 1].x, tr[i - 1].y, tr[i].x, tr[i].y, 4, i > tr.length - 4 ? PAL.cream : PAL.bone); return; }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const [wd, col] of [[16, 'rgba(255,170,110,0.16)'], [7, 'rgba(255,225,200,0.55)'], [2.5, 'rgba(255,255,255,0.95)']]) {
      ctx.strokeStyle = col;
      for (let i = 1; i < tr.length; i++) { const k = i / (tr.length - 1); ctx.lineWidth = wd * (0.15 + 0.85 * k) * Math.max(0.2, 1 - tr[i].t / 0.2); ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke(); }
    }
    ctx.restore();
  }
  // отец со спины, факел слева, меч справа (следует за взмахом)
  function drawFatherBack(ctx) {
    const target = N.swT > 0 ? N.swAng : -1.15 + Math.sin(N.pt * 1.6) * 0.05;
    N.swordA = N.swordA == null ? target : N.swordA + Math.atan2(Math.sin(target - N.swordA), Math.cos(target - N.swordA)) * 0.35;
    const a = N.swordA, t = N.pt;
    if (STYLE.pixel) {
      const c = pxSpriteCanvas(SPR_TW.FATHER_BACK, { r: PAL.red, c: PAL.brown, g: PAL.brown2, k: PAL.body, d: PAL.ink }, 'twfather');
      ctx.drawImage(c, 480 - 42, H - 108, 84, 108);
      pxLine(ctx, 446, 476, 418, 452, 4, PAL.body); pxLine(ctx, 418, 452, 410, 424, 4, PAL.wood); pxCampfire(ctx, 410, 424, t);
      pxLine(ctx, 514, 476, 514 + Math.cos(a) * 26, 476 + Math.sin(a) * 26, 4, PAL.body);
      const hx = 514 + Math.cos(a) * 26, hy = 476 + Math.sin(a) * 26; pxLine(ctx, hx, hy, hx + Math.cos(a) * 64, hy + Math.sin(a) * 64, 4, PAL.bone);
      return;
    }
    const hb = img('spr_hero_b');
    if (hb) { // герой со спины: спрайт, «меч» — посох в замахе
      const h = 190, w = h * hb.width / hb.height; ctx.save(); ctx.translate(480, 548);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, 2, 56, 10, 0, 0, TAU); ctx.fill();
      ctx.drawImage(hb, -w / 2, -h + 4, w, h);
      const hx = 40 + Math.cos(a) * 34, hy = -90 + Math.sin(a) * 34;
      ctx.lineCap = 'round'; ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * 96, hy + Math.sin(a) * 96); ctx.stroke();
      ctx.strokeStyle = '#c99a58'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * 96, hy + Math.sin(a) * 96); ctx.stroke();
      ctx.restore(); return;
    }
    ctx.save(); ctx.translate(480, 548);
    ctx.fillStyle = '#0a0607';
    ctx.beginPath(); ctx.moveTo(-64, 10); ctx.quadraticCurveTo(-62, -58, -44, -82); ctx.quadraticCurveTo(-24, -96, 0, -96); ctx.quadraticCurveTo(24, -96, 44, -82); ctx.quadraticCurveTo(62, -58, 64, 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(70,46,40,0.55)'; ctx.lineWidth = 2; for (const fx of [-30, -10, 14, 34]) { ctx.beginPath(); ctx.moveTo(fx * 0.7, -80); ctx.quadraticCurveTo(fx, -40, fx * 1.1, 10); ctx.stroke(); }
    // шлем сзади и гребень-грива
    ctx.fillStyle = '#1a1214'; ctx.beginPath(); ctx.ellipse(0, -112, 17, 20, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7a1418'; ctx.beginPath(); ctx.moveTo(-5, -132); ctx.quadraticCurveTo(0, -152, 6, -132); ctx.lineTo(9, -100); ctx.quadraticCurveTo(0, -88, -9, -100); ctx.closePath(); ctx.fill();
    // контровой свет факела
    ctx.strokeStyle = 'rgba(255,150,80,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-60, -20); ctx.quadraticCurveTo(-58, -62, -42, -82); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -112, 17, Math.PI * 0.8, Math.PI * 1.35); ctx.stroke();
    // рука с факелом
    ctx.lineCap = 'round'; ctx.strokeStyle = '#0a0607'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-40, -76); ctx.lineTo(-72, -96); ctx.stroke();
    ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-72, -96); ctx.lineTo(-82, -126); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) { const h = 22 + Math.sin(t * 9 + i * 1.7) * 5 - i * 3, w = 9 - i * 2; ctx.fillStyle = ['#ff5a1a', '#ff8a2a', '#ffc04a', '#fff0c0'][i]; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(-82 - w, -126); ctx.quadraticCurveTo(-82 - w * 0.4 + Math.sin(t * 7 + i) * 3, -126 - h * 0.6, -82 + Math.sin(t * 5 + i) * 2, -126 - h); ctx.quadraticCurveTo(-82 + w * 0.5, -126 - h * 0.5, -82 + w, -126); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // рука с мечом
    const hx = 40 + Math.cos(a) * 34, hy = -76 + Math.sin(a) * 34;
    ctx.strokeStyle = '#0a0607'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(40, -76); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = '#cfd4dc'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * 84, hy + Math.sin(a) * 84); ctx.stroke();
    ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx - Math.sin(a) * 9, hy + Math.cos(a) * 9); ctx.lineTo(hx + Math.sin(a) * 9, hy - Math.cos(a) * 9); ctx.stroke();
    ctx.restore();
  }
  // зверь: в тумане — тёмный силуэт-пятно (одинаковый у волка и овцы), на свету проявляется (L 0→1 за ~0,2 с)
  function drawRunner(ctx, r, o = {}) {
    const snap = o.snap, a = snap ? 1 : (r.a ?? 1) * sstep(0, 0.07, r.u);
    if (a <= 0.01) return;
    const L = snap ? 1 : r.lit ? sstep(0, 0.2, N.t - r.litAt) : 0;
    const fog = snap || r.lit ? 0 : clamp(N.fogNow * (1 - sstep(0.1, r.litU ?? ZONE, r.u)) + 0.06, 0, 1);
    const y = r.y - (r.jz || 0);
    if (STYLE.pixel) return pxRunner(ctx, r, y, fog, a, L, o);
    const s = r.s;
    if (!snap) { const k = 1 - Math.min(0.5, (r.jz || 0) / (150 * s + 1)); ctx.fillStyle = `rgba(0,0,0,${0.36 * a * k})`; ctx.beginPath(); ctx.ellipse(r.x, r.y, 50 * s * k, 9 * s * k + 1, 0, 0, TAU); ctx.fill(); } // тень сжимается в прыжке
    ctx.save(); ctx.translate(r.x, y); if (r.lean) ctx.transform(1, 0, r.lean, 1, 0, 0); const sq = r.sq || 0; ctx.scale(1 - sq * 0.6, 1 + sq);
    if (L < 1) paintShade(ctx, s, { seed: r.seed || 1, fog, a: a * (1 - L), big: r.kind === 'alpha' });
    if (L > 0) {
      const f2 = 0.4 * (1 - L);
      const spr = img(r.kind === 'sheep' ? 'spr_sheep_f' : 'spr_wolf_f');
      if (spr) { const w = (r.kind === 'sheep' ? 118 : r.kind === 'alpha' ? 124 : 92) * s * 1.33, h = w * spr.height / spr.width; ctx.save(); ctx.globalAlpha = a * L; ctx.drawImage(spr, -w / 2, -h + 6, w, h); ctx.restore(); }
      else if (r.kind === 'sheep') paintSheepF(ctx, 0, 0, s, { t: r.t, fog: f2, a: a * L, shadow: null });
      else if (!spr) paintWolfF(ctx, 0, 0, s, { t: r.t, fog: f2, a: a * L, shadow: null, big: r.kind === 'alpha', hit: r.hitT, open: r.state === 'lunge' || r.u > 0.93, scar: r.scar });
    }
    if (!snap && L < 1 && r.lit) { ctx.globalCompositeOperation = 'lighter'; const rg = ctx.createRadialGradient(0, -60 * s, 0, 0, -60 * s, 110 * s); rg.addColorStop(0, `rgba(255,200,140,${0.4 * (1 - L) * a})`); rg.addColorStop(1, 'rgba(255,160,90,0)'); ctx.fillStyle = rg; ctx.fillRect(-120 * s, -180 * s, 240 * s, 220 * s); } // вспышка света при проявлении
    ctx.restore();
  }
  // силуэт: бугристое тёмное пятно с головой и двумя выступами — выступы случайные и у волка, и у овцы
  function paintShade(ctx, s, o) {
    let z = o.seed >>> 0 || 1; const rnd = () => ((z = (z * 1664525 + 1013904223) >>> 0) / 4294967296);
    const f = o.fog, q = s * 1.33, col = mix('#050408', FOG, f * 0.42);
    ctx.save(); ctx.scale(q, q); ctx.globalAlpha = o.a; ctx.fillStyle = col;
    if (f > 0.35) { ctx.shadowColor = col; ctx.shadowBlur = 8 * f * Math.min(1, s * 2); } // мягкий край: туман «съедает» контур
    ctx.fillRect(-18, -34, 10, 34); ctx.fillRect(8, -34, 10, 34);
    ctx.beginPath(); for (let i = 0; i < 18; i++) { const an = i / 18 * TAU, rr = 0.88 + rnd() * 0.22, x = Math.cos(an) * 40 * rr, y = -56 + Math.sin(an) * 32 * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -98, 23, 19, 0, 0, TAU); ctx.fill();
    for (const sd of [-1, 1]) { const h = 8 + rnd() * 14; ctx.beginPath(); ctx.moveTo(sd * 9, -110); ctx.lineTo(sd * (14 + rnd() * 6), -112 - h); ctx.lineTo(sd * 22, -104); ctx.fill(); }
    ctx.restore();
  }
  function pxRunner(ctx, r, y, fog, a, L, o) {
    const sheep = r.kind === 'sheep', fr = Math.floor(r.t * 9) % 2, hit = !o.snap && r.hitT > 0, shade = !o.snap && L < 0.34;
    let rows, map, key;
    if (shade) { const st = fog > 0.55 ? 0 : fog > 0.25 ? 1 : 2, v = (r.seed || 1) & 1; rows = v ? SPR_TW.SHADE_A : SPR_TW.SHADE_B; map = PXSHADE[st]; key = 'twsh' + v + st; }
    else {
      const st = o.snap ? 2 : L < 0.7 ? 1 : 2;
      rows = sheep ? (fr ? SPR_TW.SHEEP_B : SPR_TW.SHEEP_A) : (fr ? SPR_TW.WOLF_B : SPR_TW.WOLF_A);
      map = hit || (!o.snap && r.lit && r.revealT < 0.07) ? PXHIT : PXMAP[r.kind][st]; key = 'tw' + (sheep ? 's' : 'w') + fr;
    }
    const c = pxSpriteCanvas(rows, map, key), sq = o.snap ? 0 : r.sq || 0;
    let cell = 8 * r.s * (r.kind === 'alpha' && !shade ? 1.15 : 1); if (cell >= 2) cell = Math.round(cell / 2) * 2; // силуэт вожака того же размера
    const cx = Math.max(1, Math.round(cell * (1 - sq * 0.6))), cy = Math.max(1, Math.round(cell * (1 + sq))); // сжатие/вытяжка кратны пикселю
    const w = rows[0].length * cx, h = rows.length * cy, sn = v => Math.round(v / 2) * 2;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (!o.snap) { const k = 1 - Math.min(0.5, (r.jz || 0) / (150 * r.s + 1)); ctx.globalAlpha = a * 0.45; ctx.fillStyle = PAL.ink; ctx.fillRect(sn(r.x - w * 0.35 * k), sn(r.y - cell * 0.5), sn(w * 0.7 * k), Math.max(2, sn(cell))); }
    ctx.globalAlpha = a; ctx.drawImage(c, sn(r.x - w / 2), sn(y - h), w, h);
    if (r.scar != null && !hit && !shade) { ctx.fillStyle = PAL.cream; for (let i = 0; i < 4; i++) ctx.fillRect(sn(r.x - w * 0.25 + i * cell * 1.2), sn(y - h * 0.72 + i * cell), Math.max(2, sn(cell)), Math.max(2, sn(cell))); }
    ctx.restore();
  }
  function paintWolfF(ctx, x, y, s, o) {
    const q = s * 1.4 * (o.big ? 1.15 : 1), f = o.fog, run = o.t * 11, hit = o.hit > 0 ? 0.7 : 0;
    const C = c => mix(mix(c, '#f4e8dc', hit), FOG, f);
    const fur = C(o.big ? '#3c3e4a' : '#151217'), fur2 = C(o.big ? '#2a2c36' : '#0b090c'), mask = C(o.big ? '#b8bcc6' : '#80848f'), muz = C('#dcd6cc'), red = C('#a3141b'), ink = C('#060405');
    ctx.save(); ctx.translate(x, y); ctx.scale(q, q); ctx.globalAlpha = o.a;
    if (o.shadow != null) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(0, o.shadow / q, 30, 6, 0, 0, TAU); ctx.fill(); }
    const b = -Math.abs(Math.sin(run)) * 4;
    for (const sd of [-1, 1]) { // передние лапы по очереди
      const lift = Math.max(0, Math.sin(run + (sd > 0 ? Math.PI : 0))) * 9; ctx.fillStyle = fur2;
      ctx.fillRect(sd * 13 - 4, -34 + b, 8, 32 - lift); ctx.beginPath(); ctx.ellipse(sd * 13, -2 - lift, 6, 3.5, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = fur; ctx.beginPath(); // грудь, рваный мех
    for (let i = 0; i <= 20; i++) { const an = i / 20 * TAU, rr = i % 2 ? 1.12 : 0.95, px = Math.cos(an) * 31 * rr, py = -40 + b + Math.sin(an) * 22 * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.fill();
    ctx.save(); ctx.translate(0, b * 1.3);
    for (const sd of [-1, 1]) { ctx.fillStyle = fur; ctx.beginPath(); ctx.moveTo(sd * 8, -80); ctx.lineTo(sd * 27, -101); ctx.lineTo(sd * 25, -70); ctx.fill(); ctx.fillStyle = red; ctx.beginPath(); ctx.moveTo(sd * 13, -80); ctx.lineTo(sd * 24, -94); ctx.lineTo(sd * 23, -75); ctx.fill(); }
    ctx.fillStyle = fur; ctx.beginPath(); ctx.moveTo(-26, -72); ctx.quadraticCurveTo(0, -90, 26, -72); ctx.lineTo(30, -60); ctx.lineTo(24, -56); ctx.lineTo(27, -50); ctx.lineTo(16, -46); ctx.lineTo(8, -34);
    ctx.quadraticCurveTo(0, -30, -8, -34); ctx.lineTo(-16, -46); ctx.lineTo(-27, -50); ctx.lineTo(-24, -56); ctx.lineTo(-30, -60); ctx.closePath(); ctx.fill();
    ctx.fillStyle = mask; ctx.beginPath(); ctx.moveTo(-15, -70); ctx.quadraticCurveTo(0, -80, 15, -70); ctx.lineTo(18, -57); ctx.lineTo(9, -42); ctx.quadraticCurveTo(0, -37, -9, -42); ctx.lineTo(-18, -57); ctx.closePath(); ctx.fill();
    ctx.fillStyle = muz; ctx.beginPath(); ctx.moveTo(-8, -55); ctx.lineTo(8, -55); ctx.lineTo(6, -41); ctx.quadraticCurveTo(0, -37, -6, -41); ctx.closePath(); ctx.fill();
    ctx.fillStyle = red; ctx.beginPath(); ctx.moveTo(0, -80); ctx.lineTo(4, -73); ctx.lineTo(0, -66); ctx.lineTo(-4, -73); ctx.fill(); // ромб на лбу (как у волка автора)
    ctx.strokeStyle = red; ctx.lineWidth = 2; ctx.lineCap = 'round'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 8, -57); ctx.lineTo(sd * 13, -50); ctx.stroke(); }
    const eye = mix(o.big ? '#ffb030' : '#ff3a1c', FOG, f * 0.25); // глаза светятся сквозь туман
    ctx.fillStyle = eye; ctx.shadowColor = eye; ctx.shadowBlur = 10;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 4, -64); ctx.quadraticCurveTo(sd * 9, -69, sd * 14, -64); ctx.quadraticCurveTo(sd * 9, -61, sd * 4, -64); ctx.fill(); }
    ctx.shadowBlur = 0;
    ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(0, -46, 4.5, 3, 0, 0, TAU); ctx.fill();
    if (o.open) { ctx.fillStyle = C('#3a0608'); ctx.beginPath(); ctx.ellipse(0, -36, 7, 4.5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = C('#efe6d8'); for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 5, -39); ctx.lineTo(sd * 3.5, -33); ctx.lineTo(sd * 2, -39); ctx.fill(); } }
    ctx.fillStyle = red; ctx.fillRect(-1, -32, 1.5, 6); ctx.fillRect(5, -34, 1.2, 4);
    if (o.scar != null) { ctx.strokeStyle = C('#e8d0c0'); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-16, -76); ctx.lineTo(13, -50); ctx.stroke(); }
    ctx.restore(); ctx.restore();
  }
  function paintSheepF(ctx, x, y, s, o) {
    const q = s * 1.3, f = o.fog, run = o.t * 10, C = c => mix(c, FOG, f);
    const wool = C('#ddd4ca'), wool2 = C('#a9a097'), face = C('#2a1e20'), ear = C('#a8707a'), leg = C('#1a1214');
    ctx.save(); ctx.translate(x, y); ctx.scale(q, q); ctx.globalAlpha = o.a;
    if (o.shadow != null) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, o.shadow / q, 30, 6, 0, 0, TAU); ctx.fill(); }
    const b = -Math.abs(Math.sin(run)) * 3;
    ctx.fillStyle = leg; for (const sd of [-1, 1]) { const lift = Math.max(0, Math.sin(run + (sd > 0 ? Math.PI : 0))) * 7; ctx.fillRect(sd * 10 - 3, -24 + b, 6, 23 - lift); }
    const blobs = (list, col) => { ctx.fillStyle = col; for (const [cx, cy, rr] of list) { ctx.beginPath(); ctx.arc(cx, cy + b, rr, 0, TAU); ctx.fill(); } };
    blobs([[-22, -36, 16], [22, -36, 16], [0, -26, 18]], wool2);
    blobs([[-25, -52, 16], [25, -52, 16], [-14, -70, 16], [14, -70, 16], [0, -77, 15], [0, -48, 26], [-18, -36, 13], [18, -36, 13]], wool);
    ctx.fillStyle = face; ctx.beginPath(); ctx.ellipse(0, -48 + b, 11, 16, 0, 0, TAU); ctx.fill();
    for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * 16, -57 + b); ctx.rotate(sd * 0.35); ctx.fillStyle = face; ctx.beginPath(); ctx.ellipse(0, 0, 10, 4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = ear; ctx.beginPath(); ctx.ellipse(sd * 1, 0.5, 6, 2, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    blobs([[-6, -64, 7], [6, -64, 7], [0, -67, 7]], wool);
    for (const sd of [-1, 1]) { ctx.fillStyle = C('#efe8dc'); ctx.beginPath(); ctx.ellipse(sd * 5.5, -52 + b, 2.6, 2.2, 0, 0, TAU); ctx.fill(); ctx.fillStyle = C('#120c0e'); ctx.beginPath(); ctx.arc(sd * 5.5 + 0.3, -52 + b, 1.2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = C('#5a3a3e'); ctx.beginPath(); ctx.ellipse(0, -37 + b, 4, 2.2, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function hudToward(ctx) {
    const px = STYLE.pixel, D = N.def, y = 35;
    comicBox(ctx, 16, 10, 380, 50, 0.7);
    let x = 34;
    for (let i = 0; i < D.hearts; i++) { heart(ctx, x + i * 30, y, i < N.hearts); } x += D.hearts * 30 + 10;
    sheepIcon(ctx, x + 10, y, true); text(ctx, String(N.collected), x + 28, y, { size: 20, align: 'left', sc: true }); x += 66;
    wolfIcon(ctx, x + 10, y); text(ctx, String(N.kills), x + 28, y, { size: 20, align: 'left', sc: true }); x += 66;
    for (let i = 0; i < D.broMax; i++) { // своих можно задеть не больше broMax раз
      const cx = x + 10 + i * 26, dead = i < N.broLost; sheepIcon(ctx, cx, y, !dead);
      if (dead) { if (px) { pxLine(ctx, cx - 8, y - 8, cx + 8, y + 8, 4, PAL.red); pxLine(ctx, cx - 8, y + 8, cx + 8, y - 8, 4, PAL.red); } else { ctx.strokeStyle = '#d02a20'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 9, y - 8); ctx.lineTo(cx + 9, y + 8); ctx.moveTo(cx - 9, y + 8); ctx.lineTo(cx + 9, y - 8); ctx.stroke(); } }
    }
    if (N.react.length && N.phase === 'fight') { // реакция: последний удар и среднее
      const f = v => v.toFixed(2).replace('.', ','), avg = N.react.reduce((a, b) => a + b, 0) / N.react.length;
      text(ctx, `Реакция: ${f(N.lastReact)} с   Среднее: ${f(avg)} с`, 28, 76, { size: 16, align: 'left', sc: true, color: N.lastReact < 0.45 ? '#b8f0a0' : N.lastReact < 0.75 ? '#ffe08a' : '#ffb090' });
    }
  }
  function heart(ctx, x, y, full) {
    if (STYLE.pixel) return pxSprite(ctx, SPR_TW.HEART, x - 12, y - 12, 4, { r: full ? PAL.red : PAL.grey2 });
    ctx.fillStyle = full ? '#c8241e' : 'rgba(120,100,100,0.45)'; ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.bezierCurveTo(x - 14, y - 1, x - 8, y - 12, x, y - 5); ctx.bezierCurveTo(x + 8, y - 12, x + 14, y - 1, x, y + 9); ctx.fill();
  }
  function sheepIcon(ctx, x, y, alive) {
    if (STYLE.pixel) return pxSprite(ctx, SPR.SHEEP, x - 9, y - 6, 2, { w: alive ? PAL.cream : PAL.grey2, k: alive ? PAL.grey : PAL.night3 });
    ctx.fillStyle = alive ? '#ddd4ca' : 'rgba(150,140,130,0.4)'; for (const [cx, cy, r] of [[-4, -1, 6], [3, -2, 6], [0, 2, 6]]) { ctx.beginPath(); ctx.arc(x + cx, y + cy, r, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#2a1e20'; ctx.beginPath(); ctx.ellipse(x + 7, y - 1, 3, 4, 0, 0, TAU); ctx.fill();
  }
  function wolfIcon(ctx, x, y) {
    if (STYLE.pixel) return pxSprite(ctx, SPR.WOLF, x - 10, y - 6, 2, { k: '#8a8e9c', y: PAL.red });
    ctx.fillStyle = '#9a9ca8'; ctx.beginPath(); ctx.moveTo(x - 9, y - 10); ctx.lineTo(x - 4, y - 4); ctx.lineTo(x + 4, y - 4); ctx.lineTo(x + 9, y - 10); ctx.lineTo(x + 8, y + 1); ctx.lineTo(x, y + 10); ctx.lineTo(x - 8, y + 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff3a1c'; ctx.fillRect(x - 5, y - 1, 3, 2); ctx.fillRect(x + 2, y - 1, 3, 2);
  }
  function nearest(w) { let best = null, bd = 1e9; for (const s of N.sheep) { if (s.lost || s.carried) continue; const d = Math.abs(s.x - w.x) + Math.abs(s.y - w.y) * 0.5; if (d < bd) { bd = d; best = s; } } return best; }
  function hitWolf(w) {
    w.cut = N.swipe; w.hp--; w.hitT = 0.25; N.shake = 0.12;
    parts.burst(w.x, w.y - 18, 10, { color: ['#7a0d12', '#b0151c', '#300'], speed: [60, 240], life: [0.3, 0.7], size: [1.5, 4], g: 500, ground: 1, shape: 'drop' });
    if (w.hp <= 0) {
      w.dead = true; N.kills++; sfx('slash', { vol: 0.6 }); sfx('growl', { vol: 0.3, rate: 1.6 });
      if (w.carry) { w.carry.carried = false; w.carry.x = w.x; w.carry.scared = 0.6; w.carry = null; }
      if (Math.random() < 0.3) N.floaters.push({ x: w.x, y: w.y - 50, s: 'Небро!', color: '#ff8a70', t: 0 });
    } else { sfx('blade', { vol: 0.5 }); w.x -= w.dir * 30; if (w.carry) { w.carry.carried = false; w.carry.scared = 0.6; w.carry = null; } }
  }
  function finish() {
    if (N.phase === 'result') return;
    N.phase = 'result'; N.pt = 0;
    const saved = N.sheep.filter(s => !s.lost).length, total = N.sheep.length;
    const water = saved === total ? 2 : saved >= total / 2 ? 1 : 0;
    const gifts = Math.floor(N.kills / 8), shards = Math.floor(N.kills / 2) + saved * 2; app.save.shards = (app.save.shards || 0) + shards;
    app.save.bonusWater = water;
    for (let i = 0; i < gifts; i++) app.save.gifts[pick(['gaze', 'flash', 'amph'])]++;
    app.save.stats.wolves += N.kills;
    if (saved === total) app.ach('shepherd'); if (app.save.stats.wolves >= 60) app.ach('wolfbane');
    app.persist();
    N.result = { saved, total, kills: N.kills, water, gifts, shards };
    sfx('sacred', { vol: 0.4 });
  }

  // ---------------------------------------------------------------- отрисовка
  function drawNight(ctx) {
    const inp = app.inp;
    ctx.save();
    if (N.shake > 0) ctx.translate(Math.sin(N.pt * 90) * N.shake * 10, 0);
    drawCam(ctx, img('bg_valley'), [0.5, 0.55, 1.1]);
    ctx.fillStyle = 'rgba(6,4,10,0.5)'; ctx.fillRect(0, 0, W, H);
    // земля
    if (!STYLE.pixel) { const g = ctx.createLinearGradient(0, 300, 0, H); g.addColorStop(0, 'rgba(20,14,16,0)'); g.addColorStop(1, 'rgba(12,8,9,0.85)'); ctx.fillStyle = g; ctx.fillRect(0, 300, W, H - 300); }
    // костёр
    const fx = 480, fy = 492;
    if (!STYLE.pixel) { const lg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 260); lg.addColorStop(0, 'rgba(255,150,70,0.28)'); lg.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 230, W, H - 230); }
    if (Math.random() < 0.6) parts.spawn({ x: fx + rand(-14, 14), y: fy - 6, vx: rand(-15, 15), vy: rand(-120, -50), life: rand(0.4, 1), size: rand(1, 2.5), color: pick(['#ffcf6a', '#ff7a2a']), glow: true, g: -20 });
    drawFire(ctx, fx, fy, N.pt);
    // овцы и волки по глубине
    const ents = [...N.sheep.filter(s => !s.lost).map(s => ({ y: s.y, d: () => drawSheep(ctx, s) })), ...N.wolves.map(w => ({ y: w.y, d: () => drawWolf(ctx, w) })),
      ...N.runners.map(r => ({ y: r.y, d: () => r.kind === 'sheep' ? drawSheep(ctx, { x: r.x, y: r.y, t: r.t, scared: r.flee ? 1 : 0, carried: false }) : drawWolf(ctx, { ...r, y: r.y - r.jz }) }))].sort((a, b) => a.y - b.y);
    // отец
    drawFather(ctx, 480, 470, N.pt, N.trail.length > 2);
    for (const e of ents) e.d();
    parts.draw(ctx);
    // след меча
    if (N.trail.length > 1 && STYLE.pixel) { for (let i = 1; i < N.trail.length; i++) pxLine(ctx, N.trail[i - 1].x, N.trail[i - 1].y, N.trail[i].x, N.trail[i].y, 4, i > N.trail.length - 4 ? PAL.cream : PAL.bone); }
    else if (N.trail.length > 1) {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalCompositeOperation = 'lighter';
      for (const [lw, col] of [[10, 'rgba(255,190,140,0.18)'], [4, 'rgba(255,240,220,0.7)']]) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); N.trail.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
    for (const f of N.floaters) text(ctx, f.s, f.x, f.y, { size: 24, color: f.color, weight: 700, stroke: 3, sc: true });
    // HUD
    const alive = N.sheep.filter(s => !s.lost).length;
    comicBox(ctx, 8, 8, 300, 50, 0.7);
    if (N.mode === 'toward') text(ctx, `Стадо: ${N.collected}   Волки: ${N.kills}   Силы: ${'♥'.repeat(Math.max(0, N.hearts))}`, 22, 33, { size: 18, align: 'left', sc: true });
    else text(ctx, `Овцы: ${alive}/${N.sheep.length}   Волки: ${N.kills}`, 22, 33, { size: 18, align: 'left', sc: true });
    const left = Math.max(0, N.def.dur - N.t);
    text(ctx, N.phase === 'fight' ? (left > 0 ? `До рассвета ${Math.ceil(left)} с` : 'Рассвет близко…') : '', W / 2, 32, { size: 20, sc: true, color: '#e8d2b8' });
    if (N.phase === 'fight' && pauseButton(ctx, inp, 908, 12)) N.paused = true;
    if (N.phase === 'intro') {
      const a = Math.min(1, N.pt * 2, (4.5 - N.pt) * 2);
      ctx.globalAlpha = Math.max(0, a); comicBox(ctx, W / 2 - 280, 150, 560, 150);
      text(ctx, 'Ночь волков', W / 2, 185, { size: 30, sc: true });
      if (N.mode === 'toward') { text(ctx, 'Волки и овцы бегут к тебе. Проведи по волку — удар мечом.', W / 2, 228, { size: 18 }); text(ctx, 'Овцу пропусти — она войдёт в стадо («Бро»).', W / 2, 256, { size: 18, color: '#ffe0a8' }); }
      else { text(ctx, 'Волки рвутся к стаду. Проведи по волку — удар мечом. Вожаку нужно два удара.', W / 2, 228, { size: 18 }); text(ctx, 'Овцы — свои («Бро»). Не задень их.', W / 2, 256, { size: 18, color: '#ffe0a8' }); }
      ctx.globalAlpha = 1;
    }
    if (N.phase === 'result') drawResult(ctx, inp);
    drawPost(ctx, { tint: '#2a2a5a', tintA: 0.14 });
    if (N.paused) { const r = drawPause(ctx, inp, app.save.settings.sfx > 0); if (r === 'resume') N.paused = false; else if (r === 'sound') app.toggleSound(); else if (r === 'menu') { N.paused = false; app.goMenu(); } }
  }
  function drawResult(ctx, inp) {
    const R = N.result, a = Math.min(1, N.pt * 2);
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(6,3,5,0.6)'; ctx.fillRect(0, 0, W, H);
    comicBox(ctx, W / 2 - 230, R.toward ? 104 : 120, 460, R.toward ? 304 : 270);
    if (R.toward) {
      const f = v => v.toFixed(2).replace('.', ',');
      text(ctx, R.reason === 'bite' ? 'Волки прорвались…' : R.reason === 'bro' ? 'Ты сразил своих…' : 'Рассвет', W / 2, 142, { size: 32, sc: true });
      text(ctx, `Овец в стаде: ${R.collected}   Сражено волков: ${R.kills}`, W / 2, 184, { size: 19 });
      text(ctx, `Это стадо (${R.herd}) сыновья будут стеречь в следующем воспоминании`, W / 2, 212, { size: 17, color: '#e8f0d8' });
      if (R.kills) text(ctx, `Реакция: среднее ${f(R.reactAvg)} с, лучшая ${f(R.reactBest)} с`, W / 2, 240, { size: 18, color: R.reactAvg < 0.6 ? '#b8f0a0' : '#ffe08a' });
      const both = R.broLost && R.combos;
      if (R.broLost) text(ctx, `Погибших Бро: ${R.broLost}`, W / 2 - (both ? 100 : 0), 266, { size: 16, color: '#c9b8a6' });
      if (R.combos) text(ctx, `Двойных ударов: ${R.combos}`, W / 2 + (both ? 100 : 0), 266, { size: 16, color: '#c9b8a6' });
    } else {
      text(ctx, R.saved === 0 ? 'Волки унесли всех' : 'Рассвет', W / 2, 160, { size: 32, sc: true });
      text(ctx, `Спасено овец: ${R.saved} из ${R.total}   Сражено волков: ${R.kills}`, W / 2, 210, { size: 19 });
      text(ctx, R.water ? `Молоко и сыр отары: +${R.water} к глоткам в следующей главе` : 'Без отары — без запаса воды', W / 2, 242, { size: 17, color: '#9fd0ff' });
    }
    if (R.toward) { // награды двумя строками-кусками: каждая переводится целиком
      text(ctx, `Осколки памяти: +${R.shards}`, W / 2 - (R.gifts ? 110 : 0), 296, { size: 17, color: '#ffe0a8' });
      if (R.gifts) text(ctx, `Дары богов: +${R.gifts}`, W / 2 + 130, 296, { size: 17, color: '#ffe0a8' });
    } else text(ctx, `Осколки памяти: +${R.shards}` + (R.gifts ? `   Дары богов: +${R.gifts}` : ''), W / 2, 280, { size: 17, color: '#ffe0a8' });
    ctx.globalAlpha = 1;
    if (N.pt > 0.6 && button(ctx, inp, W / 2 - 110, R.toward ? 332 : 318, 220, 52, 'Дальше', { key: 'Enter' })) app.next();
  }
  function drawFire(ctx, x, y, t) {
    if (STYLE.pixel) return pxCampfire(ctx, x, y, t);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const h = 30 + Math.sin(t * 9 + i * 1.7) * 8 + i * 3, w = 16 - i * 2; ctx.fillStyle = ['#ff5a1a', '#ff8a2a', '#ffb84a', '#ffe08a', '#fff4d0'][i]; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.5 + Math.sin(t * 7 + i) * 4, y - h * 0.6, x + Math.sin(t * 5 + i) * 3, y - h); ctx.quadraticCurveTo(x + w * 0.5, y - h * 0.5, x + w, y); ctx.fill(); }
    ctx.restore(); ctx.fillStyle = '#1a1010'; ctx.fillRect(x - 22, y - 3, 44, 6);
  }
  function drawFather(ctx, x, y, t, swinging) {
    if (STYLE.pixel) { // спрайт отца как в сценах, меч — квадратами по сетке
      pxSprite(ctx, SPR.FATHER, x - 24, y - 112, 4, { r: PAL.red, c: PAL.cream, i: PAL.ink, k: PAL.body, g: PAL.grey2 });
      const a = swinging ? -0.9 + Math.sin(t * 30) * 0.5 : -0.4; pxLine(ctx, x + 20, y - 52, x + 20 + Math.sin(a) * 44, y - 52 - Math.cos(a) * 44, 4, PAL.bone); return;
    }
    const hero = img('spr_hero');
    if (hero) { const h = 128, w = h * hero.width / hero.height; ctx.save(); ctx.translate(x, y); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 3, 26, 6, 0, 0, TAU); ctx.fill(); if (swinging) ctx.rotate(Math.sin(t * 30) * 0.12); ctx.drawImage(hero, -w / 2, -h, w, h); ctx.restore(); return; }
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#0b0708';
    // плащ и тело
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-24, -52); ctx.quadraticCurveTo(-14, -78, 0, -80); ctx.quadraticCurveTo(14, -78, 20, -52); ctx.lineTo(16, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -90, 11, 0, TAU); ctx.fill();
    // гребень шлема
    ctx.fillStyle = '#7a1418'; ctx.beginPath(); ctx.moveTo(-12, -98); ctx.quadraticCurveTo(0, -122, 14, -96); ctx.quadraticCurveTo(0, -106, -12, -98); ctx.fill();
    // меч
    ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 3; const a = swinging ? -0.9 + Math.sin(t * 30) * 0.5 : -0.4;
    ctx.save(); ctx.translate(16, -50); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -40); ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  function drawSheep(ctx, s) {
    if (STYLE.pixel) { const fr = Math.floor(s.t * 8) % 2 ? SPR.SHEEP_B : SPR.SHEEP_A, sh = s.scared > 0 ? Math.round(Math.sin(s.t * 40)) * 4 : 0;
      pxSpriteFlip(ctx, fr, Math.round((s.x - 24) / 4) * 4 + sh, Math.round((s.y - 26) / 4) * 4, 4, { w: s.carried ? '#b58a8a' : PAL.cream, k: PAL.ink, e: PAL.ink }, s.x > 480); return; }
    const bob = Math.sin(s.t * 3) * 1.2, x = s.x, y = s.y + bob;
    const spS = img('spr_sheep');
    if (spS) { const w = 84, h = w * spS.height / spS.width; ctx.save(); ctx.translate(x, y); if (s.scared > 0) ctx.translate(Math.sin(s.t * 40) * 2, 0); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 4, 20, 4, 0, 0, TAU); ctx.fill(); if (s.x > 480) ctx.scale(-1, 1); ctx.globalAlpha = s.carried ? 0.6 : 1; ctx.drawImage(spS, -w / 2, -h + 4, w, h); ctx.restore(); return; }
    ctx.save(); ctx.translate(x, y); if (s.scared > 0) ctx.translate(Math.sin(s.t * 40) * 2, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 4, 18, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1214'; for (const lx of [-9, -3, 4, 10]) ctx.fillRect(lx, -6, 2.5, 10);
    ctx.fillStyle = s.carried ? '#b58a8a' : '#d9d0c8';
    for (const [cx, cy, r] of [[-8, -14, 8], [0, -17, 9], [8, -14, 8], [-3, -10, 8], [5, -10, 8]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#2a1e20'; ctx.beginPath(); ctx.ellipse(15, -15, 5, 6, 0.3, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawWolf(ctx, w) {
    if (STYLE.pixel) {
      const sc = w.kind === 'wolf' ? 4 : 6, fr = Math.floor(w.t * 10) % 2 ? SPR.WOLF_B : SPR.WOLF_A, body = w.hitT > 0 ? PAL.red : w.kind === 'hound' ? '#7a3418' : w.kind === 'alpha' ? '#8a8e9c' : '#5a5e6c';
      if (w.dead && (w.deadT || 0) > 0.5) return;
      pxSpriteFlip(ctx, fr, Math.round((w.x - 8.5 * sc) / 4) * 4, Math.round((w.y - 8 * sc) / 4) * 4, sc, { k: body, e: w.kind === 'hound' ? PAL.gold : PAL.red }, w.dir < 0);
      if (!w.dead && w.kind !== 'wolf') for (let i = 0; i < w.hp; i++) { ctx.fillStyle = PAL.red; ctx.fillRect(Math.round((w.x - 10) / 4) * 4 + i * 8, Math.round((w.y - 9 * sc) / 4) * 4, 4, 4); }
      return;
    }
    const run = Math.sin(w.t * 16), s = w.kind === 'wolf' ? 1 : w.kind === 'alpha' ? 1.3 : 1.45;
    ctx.save(); ctx.translate(w.x, w.y); ctx.scale(w.dir * s, s);
    if (w.dead) { ctx.globalAlpha = Math.max(0, 1 - (w.deadT || 0)); ctx.rotate(Math.PI / 2 * Math.min(1, (w.deadT || 0) * 4)); }
    if (w.hitT > 0) ctx.translate(-8 * w.hitT * 4, 0);
    const spW = img('spr_wolf');
    if (spW) { const ww = 92, hh = ww * spW.height / spW.width; ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, 3, 26, 5, 0, 0, TAU); ctx.fill(); ctx.drawImage(spW, -ww / 2, -hh + 6 + Math.sin(w.t * 16) * 1.5, ww, hh);
      if (w.hitT > 0) { ctx.globalCompositeOperation = 'source-atop'; } ctx.restore();
      if (!w.dead && w.kind !== 'wolf') for (let i = 0; i < w.hp; i++) { ctx.fillStyle = '#ff6a50'; ctx.fillRect(w.x - 10 + i * 8, w.y - 64 * s / 1.3, 6, 4); }
      return; }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0, 3, 26, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = w.hitT > 0 ? '#5a1010' : w.kind === 'hound' ? '#1a0806' : '#0c0a0b';
    // ноги
    ctx.lineWidth = 4; ctx.strokeStyle = ctx.fillStyle; ctx.lineCap = 'round';
    for (const [lx, ph] of [[-14, 0], [-9, Math.PI], [10, Math.PI / 2], [15, -Math.PI / 2]]) { ctx.beginPath(); ctx.moveTo(lx, -14); ctx.lineTo(lx + Math.sin(w.t * 16 + ph) * 7, 0); ctx.stroke(); }
    // тело, шея, голова, хвост
    ctx.beginPath(); ctx.ellipse(0, -20, 22, 9 + run, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(14, -26); ctx.lineTo(26, -34); ctx.lineTo(38, -30); ctx.lineTo(40, -25); ctx.lineTo(28, -20); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(25, -35); ctx.lineTo(28, -44); ctx.lineTo(31, -34); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-20, -22); ctx.quadraticCurveTo(-34, -24 + run * 3, -40, -16); ctx.quadraticCurveTo(-30, -18, -20, -16); ctx.fill();
    // глаз
    ctx.fillStyle = w.kind === 'hound' ? '#ffb030' : '#ff2a20'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(32, -30, 1.8, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    if (w.kind === 'hound') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,120,30,0.35)'; ctx.beginPath(); ctx.arc(0, -22, 26 + run * 2, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (!w.dead && w.kind !== 'wolf') for (let i = 0; i < w.hp; i++) { ctx.fillStyle = '#ff6a50'; ctx.fillRect(w.x - 10 + i * 8, w.y - 64 * s / 1.3, 6, 4); }
  }
  return scene;
}
