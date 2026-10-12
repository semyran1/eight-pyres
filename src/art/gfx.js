// Графика кодом: картинки автора (загрузчик), текст и кнопки, дождь, туман, молнии, искры, души, небо,
// знаки сыновей на щитах. Всё в координатах 960×540.
import { rand, TAU, clamp } from '../engine/util.js';
import { tr } from '../game/i18n.js';
import { isScene, pxScene, drawPxScene, PS, PAL, pxIcon, pxBadge, pxGlyph, pxAmphora, pxSoul, pxBoltPath, pxPanel, pxFrame, pxLine } from './pixel.js';
import { pxText, pxMeasure, PXL } from './pxfont.js';
export const W = 960, H = 540;

// ---- картинки
const imgs = new Map();
// стиль: живописный (по умолчанию) или пиксельный (как Flat 2.2) — меняются только картинки, шрифт и буфер кадра
export const STYLE = { pixel: false };
export const IMAGES = ['bg_moon1', 'bg_moon2', 'bg_moon3', 'bg_moon4', 'bg_door', 'bg_valley', 'bg_red', 'bg_dawn', 'fire_hq', 'pyre_helm', 'pyre_coins',
  'menu_a', 'menu_b', 'menu_c', 'c_face', 'c_kneel', 'c_pyre', 'c_kneel_tall', 'c_pray', 'c_bolt', 'c_ares', 'c_alive', 'c_phobos',
  'c_wolves', 'c_styx', 'c_club', 'card_helm', 'card_skull', 'card_coin', 'card_flask', 'card_bolt', 'card_shield', 'card_foe',
  'card_back', 'card_hound', 'card_raven', 'card_spears', 'card_phobos', 'card_deimos', 'card_amphora', 'card_owl', 'card_living',
  'son_shield', 'helm_big', 'pyre0', 'pyre_logs',
  // кадры рассказов сыновей (Flux, локально)
  't1_shore_sheep', 't1_raiders_land', 't1_send_brother', 't1_chase_alone', 't2_gallop_gate', 't2_brothers_arm', 't3_boat_dawn', 't3_reeds_ambush',
  't4_ravine_fight', 't4_shield_boy', 't5_healer_fog', 't6_war_song', 't6_broken_lyre', 't7_duel', 't8_hide_brother', 't8_ships_leave',
  'm1_boys_sheep', 'm2_herd_camp', 'm3_lyre_fire', 'm4_raid_dawn', 'e1_cattle_return', 'e2_alcmene_stars', 'e3_souls_stars', 'p1_walk_field', 'p2_father_pyre'];
export function loadImages(base = 'assets/img/') {
  const PX = ['card_helm', 'card_skull', 'card_flask', 'card_coin', 'card_bolt', 'card_shield', 'card_spears', 'card_foe', 'card_back', 'card_raven', 'card_hound',
    'card_owl', 'card_phobos', 'card_deimos', 'card_living', 'card_amphora', 'pyre0', 'pyre_helm', 'pyre_coins', 'pyre_logs', 'helm_big', 'card_decoy0', 'card_decoy1', 'card_decoy2', 'card_decoy3', 'card_decoy4', 'card_decoy5', 'fire_px'];
  const load = (n, src, fallback) => new Promise(res => { const im = new Image(); im.onload = () => { imgs.set(n, im); res(); }; im.onerror = () => fallback ? load(n, fallback).then(res) : res(); im.src = src; });
  // пиксельная версия: сцены рисуются кодом (pixel.js), живописные фоны и кадры не грузятся
  const names = STYLE.pixel ? [...new Set([...IMAGES, ...PX])].filter(n => !isScene(n)) : IMAGES;
  const one = n => STYLE.pixel ? load(n, 'assets/px/' + n + '.webp', base + n + '.webp') : load(n, base + n + '.webp');
  // сначала основное (меню, первые поля, карты, костёр) — игра стартует; кадры комикса догружаются в фоне
  const lazy = n => /^(c_|t\d|m\d|e\d|p\d|menu_b|menu_c|bg_valley|bg_dawn|bg_door|bg_red)/.test(n) && !['c_face', 'c_kneel', 'c_kneel_tall', 'c_pray', 'c_bolt'].includes(n);
  const core = names.filter(n => !lazy(n)), rest = names.filter(lazy);
  return Promise.all(core.map(one)).then(() => { lazyDone = (async () => { for (const n of rest) await one(n); })(); });
}
let lazyDone = Promise.resolve();
// дождаться картинок (для сцены комикса, если фоновая загрузка ещё идёт)
export function whenImages(names) { return names.every(n => imgs.has(n)) ? Promise.resolve() : lazyDone; }
export function addImages(list) { for (const n of list) if (!IMAGES.includes(n)) IMAGES.push(n); }
export const img = n => {
  if (FACES[n]) return faceVariant(n);
  if (STYLE.pixel && isScene(n)) return pxScene(n);
  if (n === 'card_back' && COS.back) return backVariant(COS.back);
  const a = (ART.set !== 'base' && !STYLE.pixel && artImgs[ART.set]?.get(n)) || imgs.get(n);
  return a && CARD_TINT[n] && !STYLE.pixel && !TINT_BAKED.has(ART.set) ? tinted(a, n) : a;
};
// У каждой карты свой цвет: запоминается не только форма, но и цвет (в пиксельной версии это и помогало играть).
// Наборы qwen и qink уже собраны с цветом (tools/compose_cards.py), остальным оттенок добавляется на лету.
export const CARD_TINT = { card_helm: '#b02a20', card_shield: '#d4a020', card_spears: '#46601a', card_laurel: '#2f9a50', card_flask: '#1f8f8f', card_coin: '#4a72b8',
  card_foe: '#3c4296', card_bolt: '#8040c0', card_deimos: '#b83c96', card_raven: '#5a2c52', card_phobos: '#7a1230', card_hound: '#d4561a', card_amphora: '#c47c5c',
  card_skull: '#a29c8c', card_owl: '#dcd45c', card_horn: '#7e5634', card_lethe: '#86bcd0' };
export const TINT_BAKED = new Set(['qwen', 'qink', 'silh', 'sin', 'cut', 'mig', 'flat', 'vase', 'lek', 'mos']);
const tintCache = new WeakMap();
function tinted(src, n) {
  let m = tintCache.get(src); if (m) return m;
  const w = src.width, h = src.height, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'color'; x.globalAlpha = 0.62; x.fillStyle = CARD_TINT[n]; x.fillRect(0, 0, w, h);
  x.globalAlpha = 1; x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0);
  tintCache.set(src, c); return c;
}

// ---- наборы арта для сравнения (только живопись): assets/art/<набор>/<имя>.webp, список — assets/art/manifest.json
// Чего нет в наборе — берётся исходное (base). Загрузка — в фоне при выборе набора, кадр подменяется по прибытии файла.
export const ART = { set: 'base', sets: ['base'], have: {}, loaded: {}, root: 'assets/art/' };
export const ART_LABEL = { base: 'исходный', silh: 'A · силуэт и красная луна', sin: 'B · Sin City', cut: 'C · линогравюра', mig: 'D · Мигнола', flat: 'E · Тартаковский', vase: 'F · греческая вазопись', lek: 'G · белофонная лекиф', mos: 'H · античная мозаика', qwen: 'Qwen · акварель Миллера', qink: 'Qwen · чёрная тушь', qvase: 'Qwen · греческая ваза', z: 'Z · комикс' };
const ART_CYCLE = ['sin', 'cut', 'mig', 'flat', 'vase', 'lek', 'mos'];   // F2 листает только их (остальные — по ?art=)
const artImgs = {}, artQueued = {};
// манифест; нет файла — наборов нет (переключатель покажет только «исходный»)
export function loadArtManifest(root) {
  if (root) ART.root = root;
  return fetch(ART.root + 'manifest.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).catch(() => ({})).then(m => {
    const names = Object.keys(m || {}).filter(k => k !== 'base' && Array.isArray(m[k]) && m[k].length);
    for (const k of names) ART.have[k] = m[k];
    ART.sets = ['base', ...ART_CYCLE.filter(k => names.includes(k))];
  });
}
// порядок: сцены (фоны, меню, комикс-плашки) → кадры рассказов → остальное (карты, интерфейс)
const artPri = n => /^(bg_|menu_|c_)/.test(n) ? 0 : /^(t|m|e|p)\d/.test(n) ? 1 : 2;
function artLoad(set) {
  if (STYLE.pixel || set === 'base' || !ART.have[set]) return;
  const map = artImgs[set] ||= new Map(), q = artQueued[set] ||= new Set();
  const list = ART.have[set].filter(n => !q.has(n)).sort((a, b) => artPri(a) - artPri(b));
  list.forEach(n => q.add(n));
  let i = 0;
  const next = () => { if (i >= list.length) return; const n = list[i++], im = new Image();
    im.onload = () => { map.set(n, im); ART.loaded[set] = map.size; next(); }; im.onerror = () => next();   // битый файл — молча остаётся base
    im.src = ART.root + set + '/' + n + '.webp'; };
  for (let k = 0; k < 3; k++) next();   // 3 потока
}
// выбрать набор; манифест перечитывается — дорисованные за это время файлы тоже подтянутся
export function setArtSet(s) {
  ART.set = (ART.sets.includes(s) || ART.have[s]) ? s : 'base';
  artLoad(ART.set);
  if (ART.set !== 'base') { const cur = ART.set; loadArtManifest().then(() => { if (ART.set === cur) artLoad(cur); }); }
  return ART.set;
}
export const nextArtSet = () => ART.sets[(ART.sets.indexOf(ART.set) + 1) % ART.sets.length];
export const artLabel = (s = ART.set) => 'Арт: ' + (ART_LABEL[s] || s);

// ---- косметика за достижения (main.js держит в синхроне с save.cos): рубашка карт и звёзды созвездия
export const COS = { back: null, stars: [] };
const backCache = new Map();
// тон — перекраска камня с сохранением фактуры (живопись) / два цвета вместо ч/б (пиксели) + свой рисунок
const BACKS = {
  bf: { tint: '#c4622d', mul: '#e09060', px: ['#c86a32', '#140a06'], motif: (x, w, h) => {   // чернофигурная: чёрный шлем с процарапанными линиями, меандр
    for (const by of [0.07, 0.86]) { x.fillStyle = '#140a06'; x.fillRect(w * 0.08, h * by, w * 0.84, h * 0.07); meanderRow(x, w * 0.1, h * by + h * 0.012, w * 0.8, h * 0.046, '#d0743a', Math.max(2, w * 0.012)); }
    x.save(); x.translate(w / 2, h * 0.5); x.scale(w / 348, w / 348); x.fillStyle = '#140a06';
    x.beginPath(); x.moveTo(-70, 90); x.lineTo(-74, -10); x.bezierCurveTo(-74, -80, -30, -104, 0, -104); x.bezierCurveTo(30, -104, 74, -80, 74, -10); x.lineTo(70, 90); x.lineTo(26, 90); x.lineTo(20, 10); x.lineTo(-20, 10); x.lineTo(-26, 90); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(-6, -150); x.bezierCurveTo(60, -150, 100, -120, 96, -60); x.lineTo(70, -70); x.bezierCurveTo(70, -110, 30, -124, -6, -124); x.closePath(); x.fill();   // гребень
    x.strokeStyle = '#d0743a'; x.lineWidth = 3; x.beginPath(); x.moveTo(-60, -30); x.lineTo(-14, -30); x.lineTo(-14, 6); x.moveTo(60, -30); x.lineTo(14, -30); x.lineTo(14, 6); x.moveTo(0, -30); x.lineTo(0, 40); x.stroke();   // глазницы и наносник — процарапаны
    x.restore();
  } },
  storm: { tint: '#2c4c9a', mul: '#6a80b8', px: ['#14304a', '#ffc800'], motif: (x, w, h) => {   // грозовая: золотая молния и звёзды
    x.save(); x.shadowColor = 'rgba(255,210,120,0.9)'; x.shadowBlur = w * 0.06; x.fillStyle = '#ffd36a';
    x.beginPath(); [[0.58, 0.18], [0.36, 0.52], [0.5, 0.52], [0.4, 0.84], [0.66, 0.44], [0.52, 0.44], [0.62, 0.18]].forEach(([a, b], i) => i ? x.lineTo(w * a, h * b) : x.moveTo(w * a, h * b)); x.closePath(); x.fill(); x.restore();
    x.fillStyle = '#fff0c8'; for (let i = 0; i < 14; i++) { const sx = w * (0.14 + 0.72 * ((i * 0.618) % 1)), sy = h * (0.1 + 0.8 * ((i * 0.377) % 1)); x.fillRect(sx, sy, w * 0.012, w * 0.012); }
  } },
  gold: { tint: '#d0a040', mul: '#f2d488', px: ['#c88c1e', '#3a2010'], motif: (x, w, h) => {   // золотая: созвездие сыновей
    // ночное небо в позолоченной раме поверх руны, на нём — золотое созвездие
    x.fillStyle = '#141a2c'; x.beginPath(); x.ellipse(w / 2, h / 2, w * 0.36, h * 0.34, 0, 0, TAU); x.fill();
    x.strokeStyle = '#f0c860'; x.lineWidth = w * 0.025; x.stroke(); x.strokeStyle = '#5a3a10'; x.lineWidth = w * 0.006; x.beginPath(); x.ellipse(w / 2, h / 2, w * 0.33, h * 0.315, 0, 0, TAU); x.stroke();
    const P = CONSTELLATION.map(([a, b]) => [w * 0.5 + (a - 508) * w / 290, h * 0.5 + (b - 194) * w / 290]);
    x.strokeStyle = 'rgba(240,200,110,0.8)'; x.lineWidth = Math.max(1.5, w * 0.01); x.setLineDash([w * 0.025, w * 0.02]);
    for (const [a, b] of HERC_LINES) { x.beginPath(); x.moveTo(...P[a]); x.lineTo(...P[b]); x.stroke(); }
    x.setLineDash([]); x.shadowColor = 'rgba(255,220,140,0.9)'; x.shadowBlur = w * 0.04;
    for (const [a, b] of P) { x.fillStyle = '#fff4d0'; x.beginPath(); x.arc(a, b, w * 0.022, 0, TAU); x.fill(); }
    x.shadowBlur = 0;
  } },
  // --- Хранилище (progress.js BACKS_SHOP): угольная, совиная, морская, костяная, вороная; награды Гнева — багровая, железная, солнечная
  ember: { tint: '#7a2a14', mul: '#c0663a', px: ['#7a2210', '#ffb030'], motif: (x, w, h) => {
    for (const [cx, k] of [[0.3, 0.8], [0.5, 1], [0.7, 0.7]]) { x.fillStyle = '#ff8a2a'; x.beginPath(); x.moveTo(w * (cx - 0.1), h * 0.8); x.bezierCurveTo(w * (cx - 0.12), h * (0.8 - 0.2 * k), w * cx, h * (0.62 - 0.2 * k), w * cx, h * (0.38 - 0.1 * k)); x.bezierCurveTo(w * (cx + 0.06), h * (0.6 - 0.12 * k), w * (cx + 0.14), h * (0.7), w * (cx + 0.1), h * 0.8); x.closePath(); x.fill(); x.fillStyle = '#ffd36a'; x.beginPath(); x.ellipse(w * cx, h * 0.74, w * 0.04, h * 0.07, 0, 0, TAU); x.fill(); }
    x.fillStyle = '#ffcf7a'; for (let i = 0; i < 12; i++) x.fillRect(w * (0.12 + 0.76 * ((i * 0.618) % 1)), h * (0.1 + 0.5 * ((i * 0.377) % 1)), w * 0.012, w * 0.012);
  } },
  owl: { tint: '#4a5a6a', mul: '#9aa8b8', px: ['#243a52', '#ffd040'], motif: (x, w, h) => {
    for (const dx of [-0.17, 0.17]) { x.fillStyle = '#f2c84a'; x.beginPath(); x.arc(w * (0.5 + dx), h * 0.45, w * 0.13, 0, TAU); x.fill(); x.fillStyle = '#10141c'; x.beginPath(); x.arc(w * (0.5 + dx), h * 0.45, w * 0.06, 0, TAU); x.fill(); x.strokeStyle = '#10141c'; x.lineWidth = w * 0.02; x.beginPath(); x.arc(w * (0.5 + dx), h * 0.45, w * 0.13, 0, TAU); x.stroke(); }
    x.fillStyle = '#d8a050'; x.beginPath(); x.moveTo(w * 0.46, h * 0.52); x.lineTo(w * 0.54, h * 0.52); x.lineTo(w * 0.5, h * 0.62); x.closePath(); x.fill();
  } },
  wave: { tint: '#1f7a8a', mul: '#6ab0b8', px: ['#0e5a6a', '#a0f0f0'], motif: (x, w, h) => {
    x.strokeStyle = '#e8fbff'; x.lineWidth = w * 0.025; x.lineCap = 'round';
    for (let k = 0; k < 5; k++) { x.beginPath(); for (let i = 0; i <= 24; i++) { const xx = w * (0.14 + i * 0.72 / 24); x.lineTo(xx, h * (0.3 + k * 0.1) + Math.sin(i / 24 * TAU * 2 + k) * h * 0.02); } x.stroke(); }
  } },
  bone: { tint: '#b8b0a0', mul: '#e8e2d4', px: ['#6a6458', '#f4f0e0'], motif: (x, w, h) => {
    x.strokeStyle = '#2a2420'; x.fillStyle = '#f4efe0'; x.lineWidth = w * 0.016;
    for (const sg of [-1, 1]) { x.save(); x.translate(w / 2, h / 2); x.rotate(sg * 0.7); x.beginPath(); x.rect(-w * 0.3, -w * 0.025, w * 0.6, w * 0.05); x.fill(); x.stroke(); for (const ex of [-0.3, 0.3]) for (const ey of [-0.03, 0.03]) { x.beginPath(); x.arc(w * ex, w * ey, w * 0.04, 0, TAU); x.fill(); x.stroke(); } x.restore(); }
  } },
  crow: { tint: '#222630', mul: '#6a7080', px: ['#101018', '#c8ccd8'], motif: (x, w, h) => {
    x.fillStyle = '#0a0b10'; x.beginPath(); x.moveTo(w * 0.62, h * 0.2); x.bezierCurveTo(w * 0.86, h * 0.4, w * 0.6, h * 0.7, w * 0.4, h * 0.82); x.bezierCurveTo(w * 0.5, h * 0.6, w * 0.4, h * 0.4, w * 0.62, h * 0.2); x.closePath(); x.fill();
    x.strokeStyle = '#c8ccd8'; x.lineWidth = w * 0.012; x.beginPath(); x.moveTo(w * 0.62, h * 0.22); x.lineTo(w * 0.42, h * 0.8); x.stroke();
    for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(w * (0.6 - i * 0.035), h * (0.3 + i * 0.09)); x.lineTo(w * (0.7 - i * 0.03), h * (0.34 + i * 0.08)); x.stroke(); }
  } },
  ares: { tint: '#a0121e', mul: '#d86a6a', px: ['#a01018', '#ffe0c0'], motif: (x, w, h) => {
    x.strokeStyle = '#f0d8b0'; x.lineWidth = w * 0.025; for (const sg of [-1, 1]) { x.beginPath(); x.moveTo(w * (0.5 - sg * 0.22), h * 0.78); x.lineTo(w * (0.5 + sg * 0.22), h * 0.22); x.stroke(); x.fillStyle = '#f0d8b0'; x.beginPath(); x.moveTo(w * (0.5 + sg * 0.22), h * 0.16); x.lineTo(w * (0.5 + sg * 0.26), h * 0.26); x.lineTo(w * (0.5 + sg * 0.18), h * 0.26); x.closePath(); x.fill(); }
    x.fillStyle = '#2a0a0e'; x.beginPath(); x.arc(w / 2, h * 0.5, w * 0.17, 0, TAU); x.fill(); x.strokeStyle = '#f0d8b0'; x.stroke();
  } },
  iron: { tint: '#5a6068', mul: '#a8b0b8', px: ['#3a4048', '#e0e8f0'], motif: (x, w, h) => {
    x.strokeStyle = '#2a2e34'; x.lineWidth = w * 0.02; for (const k of [0.34, 0.24, 0.14]) { x.beginPath(); x.moveTo(w / 2, h * (0.5 - k)); x.lineTo(w * (0.5 + k * 0.65), h * 0.5); x.lineTo(w / 2, h * (0.5 + k)); x.lineTo(w * (0.5 - k * 0.65), h * 0.5); x.closePath(); x.stroke(); }
    x.fillStyle = '#d8e0e8'; for (const [a, b] of [[0.5, 0.18], [0.5, 0.82], [0.28, 0.5], [0.72, 0.5]]) { x.beginPath(); x.arc(w * a, h * b, w * 0.016, 0, TAU); x.fill(); }
  } },
  sun: { tint: '#e0a020', mul: '#ffe090', px: ['#e08010', '#fff0a0'], motif: (x, w, h) => {
    x.fillStyle = '#7a3a08'; x.beginPath(); x.arc(w / 2, h / 2, w * 0.15, 0, TAU); x.fill(); x.strokeStyle = '#7a3a08'; x.lineWidth = w * 0.02; x.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12, r0 = w * 0.2, r1 = w * (i % 2 ? 0.27 : 0.33); x.beginPath(); x.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0); x.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1); x.stroke(); }
  } },
};
function meanderRow(x, x0, y0, len, hh, col, lw) {
  x.strokeStyle = col; x.lineWidth = lw; x.beginPath(); const s = hh;
  for (let k = x0; k + s <= x0 + len; k += s * 1.25) { x.moveTo(k, y0 + hh); x.lineTo(k, y0); x.lineTo(k + s, y0); x.lineTo(k + s, y0 + hh * 0.7); x.lineTo(k + s * 0.35, y0 + hh * 0.7); x.lineTo(k + s * 0.35, y0 + hh * 0.35); x.lineTo(k + s * 0.65, y0 + hh * 0.35); }
  x.stroke();
}
// ---- лица новых карт «Прогрессии v4»: лавр (пара даёт +3 ✦) и горн тафийцев (открыл — две карты меняются).
// Рисуются кодом по рубашке: тонированный камень, тёмный овал, знак; в пиксельной версии — битмап 12×12 на спрайте 20×28.
const LAUREL_PX = ['..g......g..', '.gg......gg.', 'gg........gg', 'g....yy....g', 'g...yyyy...g', 'g...yyyy...g', 'gg...yy...gg', '.g........g.', '.gg......gg.', '..gg....gg..', '...gg..gg...', '....gggg....'];
const HORN_PX = ['.........ww.', '.......wwwwy', '......wwyyyy', '.....wwyy..w', '....wwyy....', '...wwyy.....', '..wwyy......', '.wwyy.......', '.wwyy.......', '.wwyyy......', '..wwyy......', '...www......'];
export const FACES = {
  card_laurel: { tint: '#2e6a34', mul: '#78b070', px: ['#1c4a28', '#a0e070'], bmp: LAUREL_PX, cols: { g: '#58c048', y: '#ffd848' }, motif: (x, w, h) => {
    x.save(); x.translate(w / 2, h / 2); x.fillStyle = '#7ad060'; x.strokeStyle = '#2a5a24'; x.lineWidth = w * 0.008;
    for (const sg of [-1, 1]) for (let i = 0; i < 7; i++) { const a = 0.3 + i * 0.42, R = w * 0.27; x.save(); x.translate(sg * Math.sin(a) * R, Math.cos(a) * R * 1.15); x.rotate(sg * (Math.PI / 2 - a) * -1 + (sg > 0 ? 0 : Math.PI)); x.beginPath(); x.ellipse(0, 0, w * 0.075, w * 0.03, 0, 0, TAU); x.fill(); x.stroke(); x.restore(); }
    x.fillStyle = '#ffd848'; x.strokeStyle = '#1a1208'; x.lineWidth = w * 0.03; x.lineJoin = 'round'; x.font = `800 ${w * 0.27}px "Cormorant Garamond", serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.strokeText('+3', 0, 0); x.fillText('+3', 0, 0); x.restore();
  } },
  card_horn: { tint: '#7a5a20', mul: '#c8a860', px: ['#4a3410', '#f0c860'], bmp: HORN_PX, cols: { w: '#e8d8a0', y: '#b88a30' }, motif: (x, w, h) => {
    x.save(); x.translate(w / 2, h / 2); x.scale(1.35, 1.35); x.translate(-w / 2, -h / 2 + h * 0.02);
    x.fillStyle = '#e0c070'; x.strokeStyle = '#3a2808'; x.lineWidth = w * 0.015; x.beginPath(); x.moveTo(w * 0.28, h * 0.62); x.bezierCurveTo(w * 0.3, h * 0.4, w * 0.5, h * 0.3, w * 0.74, h * 0.34); x.lineTo(w * 0.8, h * 0.26); x.lineTo(w * 0.86, h * 0.46); x.bezierCurveTo(w * 0.62, h * 0.44, w * 0.46, h * 0.52, w * 0.4, h * 0.7); x.closePath(); x.fill(); x.stroke();
    x.strokeStyle = '#ffd848'; x.lineWidth = w * 0.02; for (const k of [0.1, 0.18]) { x.beginPath(); x.arc(w * 0.84, h * 0.36, w * k, -0.9, 0.9); x.stroke(); }
    x.restore();
  } },
};
function faceVariant(id) {
  const key = id + (STYLE.pixel ? ':px' : ''); if (backCache.has(key)) return backCache.get(key);
  const src = imgs.get('card_back'), V = FACES[id]; if (!src) return null;
  const w = src.width, h = src.height, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  if (STYLE.pixel) {
    const d = x.getImageData(0, 0, w, h), hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), A = hex(V.px[0]);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i] = A[0]; d.data[i + 1] = A[1]; d.data[i + 2] = A[2]; }   // сплошной фон, затем знак по клеткам
    x.putImageData(d, 0, 0);
    const ox = Math.floor((w - 12) / 2), oy = Math.floor((h - 12) / 2);
    V.bmp.forEach((row, j) => [...row].forEach((ch, i) => { const col = V.cols[ch]; if (col) { x.fillStyle = col; x.fillRect(ox + i, oy + j, 1, 1); } }));
    x.fillStyle = hex2(V.px[1]); x.fillRect(1, 1, w - 2, 1); x.fillRect(1, h - 2, w - 2, 1); x.fillRect(1, 1, 1, h - 2); x.fillRect(w - 2, 1, 1, h - 2);
  } else {
    x.globalCompositeOperation = 'color'; x.fillStyle = V.tint; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = V.mul; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = '#141018'; x.beginPath(); x.ellipse(w / 2, h / 2, w * 0.36, h * 0.34, 0, 0, TAU); x.fill();
    x.strokeStyle = V.px[1]; x.lineWidth = w * 0.022; x.stroke();
    V.motif(x, w, h);
  }
  backCache.set(key, c); return c;
}
const hex2 = s => s;
export const cardBack = id => id ? backVariant(id) : imgs.get('card_back');   // превью рубашки (оверлей «Достижения»)
function backVariant(id) {
  const key = id + (STYLE.pixel ? ':px' : ''); if (backCache.has(key)) return backCache.get(key);
  const src = imgs.get('card_back'), V = BACKS[id]; if (!src || !V) return src;
  const w = src.width, h = src.height, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  if (STYLE.pixel) { // спрайт Flat ч/б: тёмное → фон, светлое → рисунок
    const d = x.getImageData(0, 0, w, h), hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), A = hex(V.px[0]), B = hex(V.px[1]);
    for (let i = 0; i < d.data.length; i += 4) { const k = d.data[i] > 128 ? B : A; d.data[i] = k[0]; d.data[i + 1] = k[1]; d.data[i + 2] = k[2]; }
    x.putImageData(d, 0, 0);
  } else {
    x.globalCompositeOperation = 'color'; x.fillStyle = V.tint; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = V.mul; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0);   // форма карты
    x.globalCompositeOperation = 'source-atop'; V.motif(x, w, h);
  }
  backCache.set(key, c); return c;
}

// картинка «cover» с камерой: k = [cx, cy, scale] — центр кадра в долях картинки и увеличение
export function drawCam(ctx, im, k, x = 0, y = 0, w = W, h = H) {
  if (!im) return;
  if (im.__px) return drawPxScene(ctx, im, k, x, y, w, h);
  const base = Math.max(w / im.width, h / im.height) * k[2];
  const dw = im.width * base, dh = im.height * base;
  let ox = x + w / 2 - k[0] * dw, oy = y + h / 2 - k[1] * dh;
  ox = clamp(ox, x + w - dw, x); oy = clamp(oy, y + h - dh, y);
  ctx.drawImage(im, ox, oy, dw, dh);
}
// высокая картинка (портрет) по центру с размытым фоном по бокам
export function drawTall(ctx, im, k) {
  if (!im) return;
  if (im.__px) return drawPxScene(ctx, im, [0.5, 0.5], 0, 0, W, H);
  ctx.save(); ctx.filter = 'blur(14px) brightness(0.45)'; drawCam(ctx, im, [0.5, k[1], 1.0]); ctx.restore();
  const s = H / im.height * 1.0 * Math.max(1, k[2]), dw = im.width * s * 1.05, dh = im.height * s * 1.05;
  const maxOff = Math.max(0, dh - H); const oy = -maxOff * clamp(k[1], 0, 1);
  ctx.drawImage(im, W / 2 - dw / 2, oy, dw, dh);
  const g = ctx.createLinearGradient(W / 2 - dw / 2 - 40, 0, W / 2 - dw / 2 + 30, 0); g.addColorStop(0, 'rgba(10,6,8,0.9)'); g.addColorStop(1, 'rgba(10,6,8,0)');
  ctx.fillStyle = g; ctx.fillRect(W / 2 - dw / 2 - 40, 0, 70, H);
  const g2 = ctx.createLinearGradient(W / 2 + dw / 2 + 40, 0, W / 2 + dw / 2 - 30, 0); g2.addColorStop(0, 'rgba(10,6,8,0.9)'); g2.addColorStop(1, 'rgba(10,6,8,0)');
  ctx.fillStyle = g2; ctx.fillRect(W / 2 + dw / 2 - 30, 0, 70, H);
}

// ---- текст
export const FONT = '"Cormorant Garamond", "Georgia", serif';
export const FONT_SC = '"Cormorant SC", "Cormorant Garamond", "Georgia", serif';
export function text(ctx, s, x, y, o = {}) {
  s = tr(s);
  if (STYLE.pixel) return pxText(ctx, s, x, y, o);   // пиксельный шрифт Flat 2.2 с кириллицей, целыми пикселями экрана
  ctx.font = `${o.weight || 600} ${o.size || 18}px ${o.sc ? FONT_SC : FONT}`;
  ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle';
  if (o.spacing) ctx.letterSpacing = o.spacing + 'px';
  if (o.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = o.blur ?? 6; }
  if (o.stroke) { ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor || '#0a0607'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.color || '#ead9c6'; ctx.fillText(s, x, y);
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; if (o.spacing) ctx.letterSpacing = '0px';
}
// ширина строки в логических единицах (пиксельный стиль — по пиксельному шрифту)
export function measure(ctx, s, size = 18, weight = 600) { s = tr(s); if (STYLE.pixel) return pxMeasure(s, size); ctx.font = `${weight} ${size}px ${FONT}`; return ctx.measureText(s).width; }
export function wrap(ctx, s, maxW, size = 18, weight = 600) {
  s = tr(s);
  if (!STYLE.pixel) ctx.font = `${weight} ${size}px ${FONT}`;
  const mw = STYLE.pixel ? t => pxMeasure(t, size) : t => ctx.measureText(t).width;
  const out = []; for (const para of String(s).split('\n')) {
    let line = ''; for (const w of para.split(' ')) { const t = line ? line + ' ' + w : w; if (mw(t) > maxW && line) { out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}

// ---- кнопки (проверяются в draw по защёлке clicked)
export function button(ctx, inp, x, y, w, h, label, o = {}) {
  const P = inp.pointer, hov = !o.disabled && P.x > x && P.x < x + w && P.y > y && P.y < y + h;
  ctx.save();
  ctx.globalAlpha = o.disabled ? 0.4 : 1;
  let size = o.size || 20;
  if (STYLE.pixel) {
    ctx.globalAlpha = 1;
    pxPanel(ctx, x, y, w, h, { fill: hov ? '#3a1418' : o.primary ? '#24141a' : PAL.table, frame: o.disabled ? '#5a5248' : hov || o.primary || (o.glow && Math.sin(performance.now() / 250) > 0) ? PAL.gold : '#d8ccb8' });
    if (o.primary) pxFrame(ctx, x + 8, y + 8, w - 16, h - 16, hov ? '#f07818' : '#8a5a20');   // главная — двойная рамка
    ctx.globalAlpha = o.disabled ? 0.45 : 1;
  } else size = plaque(ctx, x, y, w, h, hov, label, o);
  if (o.icon) o.icon(ctx, x + h / 2 + 4, y + h / 2, h * 0.32);
  text(ctx, label, x + w / 2 + (o.icon ? h * 0.3 : 0), y + h / 2 + 1, { size, sc: true, color: hov ? '#fff4e2' : STYLE.pixel ? '#ead9c6' : '#f3e0c6', spacing: 1, blur: STYLE.pixel ? 6 : 3 });
  ctx.restore();
  const hit = hov && P.clicked;
  if (hit) P.clicked = false;   // одна кнопка за клик
  return hit || (o.key && inp.uiHit(o.key));
}
// Кнопка живописной версии — черепок чернолаковой вазы: чёрный лак, кромка обожжённой глины, на торцах меандр
// терракотой; наведение — кромка раскаляется, вокруг жар углей и искры. Возвращает кегль подписи (≥16, если влезает).
function plaque(ctx, x, y, w, h, hov, label, o) {
  const t = performance.now() / 1000, c = Math.min(9, h * 0.2), ins = 4;
  const path = (d = 0) => { const X = x + d, Y = y + d, Wd = w - 2 * d, Hd = h - 2 * d, cc = Math.max(2, c - d * 0.6); ctx.beginPath(); ctx.moveTo(X + cc, Y); ctx.lineTo(X + Wd - cc, Y); ctx.lineTo(X + Wd, Y + cc); ctx.lineTo(X + Wd, Y + Hd - cc); ctx.lineTo(X + Wd - cc, Y + Hd); ctx.lineTo(X + cc, Y + Hd); ctx.lineTo(X, Y + Hd - cc); ctx.lineTo(X, Y + cc); ctx.closePath(); };
  // подпись: кегль не меньше 16; если не влезает — сперва убираем меандр, потом ужимаем до 14
  const tw = s => { ctx.font = `600 ${s}px ${FONT_SC}`; return ctx.measureText(tr(label)).width + tr(label).length; };
  let size = Math.max(16, o.size || 20), band = w >= 120 && h >= 30 ? Math.min(15, Math.round(h * 0.36)) : 0;
  if (band && tw(size) > w - 2 * (band + 14)) band = 0;
  while (size > 14 && tw(size) > w - 16) size--;
  // тень и жар
  ctx.save(); ctx.translate(2, 3); path(); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill(); ctx.restore();
  const glow = hov ? 0.9 : o.glow ? 0.5 + 0.35 * Math.sin(t * 4) : o.primary ? 0.35 + 0.15 * Math.sin(t * 2.4) : 0;   // glow — «зовёт» (тлеет)
  if (glow > 0) { ctx.save(); ctx.shadowColor = `rgba(255,${hov ? 120 : 140},40,${glow})`; ctx.shadowBlur = hov ? 20 + 4 * Math.sin(t * 7) : 14; path(); ctx.fillStyle = '#140a07'; ctx.fill(); ctx.restore(); }
  // чёрный лак с тёплым бликом сверху
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, hov ? '#3c2216' : '#2b1911'); g.addColorStop(0.45, hov ? '#22130c' : '#180e0a'); g.addColorStop(1, '#0c0605');
  path(); ctx.fillStyle = g; ctx.fill();
  // меандр терракотой на торцах (как пояс на амфоре)
  if (band) for (const bx of [x + ins + 2, x + w - ins - 2 - band]) {
    ctx.save(); ctx.fillStyle = hov ? '#c8642c' : '#a24e24'; ctx.fillRect(bx, y + ins + 2, band, h - 2 * ins - 4);
    ctx.beginPath(); ctx.rect(bx, y + ins + 2, band, h - 2 * ins - 4); ctx.clip();
    ctx.strokeStyle = '#140a07'; ctx.lineWidth = Math.max(1.6, band * 0.14); ctx.beginPath(); const s = band - 5;
    for (let ky = y + ins + 4; ky < y + h - ins - 2; ky += s + 3) { const kx = bx + 2.5; ctx.moveTo(kx, ky + s); ctx.lineTo(kx, ky); ctx.lineTo(kx + s, ky); ctx.lineTo(kx + s, ky + s * 0.7); ctx.lineTo(kx + s * 0.35, ky + s * 0.7); ctx.lineTo(kx + s * 0.35, ky + s * 0.36); ctx.lineTo(kx + s * 0.66, ky + s * 0.36); }
    ctx.stroke(); ctx.restore();
  }
  // кромка обожжённой глины и процарапанная линия внутри
  ctx.lineWidth = o.primary ? 2.5 : 2; ctx.strokeStyle = hov ? '#ffb45e' : o.primary ? '#dc8c46' : '#a8582c'; path(1); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = hov ? 'rgba(255,190,120,0.6)' : 'rgba(196,110,60,0.42)'; path(ins + 1); ctx.stroke();
  ctx.fillStyle = 'rgba(255,225,190,0.07)'; ctx.fillRect(x + c, y + 3, w - 2 * c, h * 0.28);
  // искры над раскалённой кромкой
  if (hov) for (let i = 0; i < 7; i++) {
    const ph = (t * 0.8 + i * 0.37) % 1, ex = x + w * (0.1 + 0.8 * ((i * 0.618) % 1)) + Math.sin(t * 3 + i) * 4, ey = y + 4 - ph * 22;
    ctx.globalAlpha = 1 - ph; ctx.fillStyle = i % 2 ? '#ffcf7a' : '#ff8a3a'; ctx.fillRect(ex, ey, 2, 2);
  }
  ctx.globalAlpha = o.disabled ? 0.4 : 1;
  return size;
}
// рамка «как в комиксе автора»: тёмная плашка с белой двойной обводкой
export function comicBox(ctx, x, y, w, h, a = 1) {
  if (STYLE.pixel) return pixelBox(ctx, x, y, w, h, a);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(8,5,6,0.88)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(240,228,214,0.9)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
  ctx.restore();
}

// пиксельная рамка (как панели Flat 2.2 / He Is Coming): тёмная заливка, рамка в 1 пиксель арта со срезанными углами
function pixelBox(ctx, x, y, w, h, a = 1) {
  ctx.save(); ctx.globalAlpha = a; pxPanel(ctx, x, y, w, h); ctx.restore();
}

// ---- дождь: две глубины косых струй + брызги у земли
export class Rain {
  constructor(n = 220) { this.p = Array.from({ length: n }, () => this.spawn({}, true)); this.amount = 0; this.wind = -0.25; this.splash = []; }
  spawn(q, init) { q.z = rand(0.35, 1); q.x = rand(-60, W + 60); q.y = init ? rand(-H, H) : rand(-80, -10); q.len = 10 + 18 * q.z; q.v = 700 + 600 * q.z; return q; }
  update(dt) {
    for (const q of this.p) { q.y += q.v * dt; q.x += q.v * this.wind * dt; if (q.y > H + 20) { if (Math.random() < 0.25 && this.amount > 0.2) this.splash.push({ x: q.x, y: rand(420, 540), t: 0 }); this.spawn(q); } }
    for (let i = this.splash.length - 1; i >= 0; i--) { const s = this.splash[i]; s.t += dt; if (s.t > 0.25) this.splash.splice(i, 1); }
  }
  draw(ctx, flash = 0) {
    if (this.amount <= 0.01) return;
    const n = Math.floor(this.p.length * this.amount);
    if (STYLE.pixel) { // капли — штрихи 1×3 пикселя арта по сетке
      ctx.save(); ctx.fillStyle = flash > 0.3 ? PAL.cream : PAL.grey2; PXL.under = true;
      for (let i = 0; i < n; i += 2) { const q = this.p[i]; ctx.fillRect(Math.round(q.x / PS) * PS, Math.round(q.y / PS) * PS, PS, PS * (q.z > 0.7 ? 3 : 2)); }
      PXL.under = false; ctx.restore(); return;
    }
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const q = this.p[i];
      ctx.strokeStyle = `rgba(${200 + 55 * flash},${190 + 60 * flash},${200 + 55 * flash},${0.12 + 0.22 * q.z})`; ctx.lineWidth = 0.6 + q.z * 0.9;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.len * this.wind, q.y - q.len); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(220,210,215,0.35)'; ctx.lineWidth = 1;
    for (const s of this.splash) { const k = s.t / 0.25; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.ellipse(s.x, s.y, 2 + 7 * k, 1 + 2 * k, 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
}

// ---- туман: тайл шума (кэш), два слоя плывут навстречу
let fogTile = null;
function makeFog() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const cx = rand(512), cy = rand(256), r = rand(30, 110), g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(220,205,210,0.22)'); g.addColorStop(1, 'rgba(220,205,210,0)');
    x.fillStyle = g; for (const dx of [-512, 0, 512]) { x.save(); x.translate(dx, 0); x.fillRect(cx - r, cy - r, r * 2, r * 2); x.restore(); }
  }
  // мягкие верх и низ тайла — без резкой горизонтальной кромки
  x.globalCompositeOperation = 'destination-in';
  const m = x.createLinearGradient(0, 0, 0, 256); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.3, 'rgba(0,0,0,1)'); m.addColorStop(0.7, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = m; x.fillRect(0, 0, 512, 256);
  return c;
}
let pxFog = null;
export class Fog {
  constructor() { this.t = 0; this.amount = 0; }
  update(dt) { this.t += dt; }
  draw(ctx, y0 = 200, tint = null) {
    if (this.amount <= 0.01) return;
    if (STYLE.pixel) { // полосы тумана — упорядоченный дизеринг, сдвиг по сетке
      if (!pxFog) { pxFog = document.createElement('canvas'); pxFog.width = 60; pxFog.height = 24; const c = pxFog.getContext('2d'); c.fillStyle = PAL.grey2;
        const B = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
        for (let j = 0; j < 24; j++) for (let i = 0; i < 60; i++) { const d = 7 * Math.sin(Math.PI * j / 24) * (0.7 + 0.3 * Math.sin(i / 60 * TAU * 2)); if (B[j & 3][i & 3] < d) c.fillRect(i, j, 1, 1); } }
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = Math.min(1, this.amount * 1.6); PXL.under = true;
      for (const [sp, yy] of [[10, y0], [-16, y0 + 110]]) { const off = Math.round((((this.t * sp) % 240) + 240) % 240 / PS) * PS; for (let x = -off; x < W; x += 240) ctx.drawImage(pxFog, x, yy, 240, 96); }
      PXL.under = false; ctx.restore(); return;
    }
    fogTile ??= makeFog();
    ctx.save(); ctx.globalAlpha = this.amount;
    if (tint) ctx.filter = tint;
    for (const [sp, yy, sc, a] of [[14, y0, 1.6, 0.8], [-22, y0 + 90, 2.2, 1]]) {
      const off = ((this.t * sp) % (512 * sc) + 512 * sc) % (512 * sc);
      ctx.globalAlpha = this.amount * a;
      for (let x = -off; x < W; x += 512 * sc) ctx.drawImage(fogTile, x, yy, 512 * sc, 256 * sc);
    }
    ctx.restore();
  }
}

// ---- молния: ломаная с ответвлениями + вспышка неба
export function boltPath(x0, y0, x1, y1, rough = 26) {
  const pts = [[x0, y0]]; const n = 12;
  for (let i = 1; i < n; i++) { const k = i / n; pts.push([x0 + (x1 - x0) * k + rand(-rough, rough), y0 + (y1 - y0) * k + rand(-6, 6)]); }
  pts.push([x1, y1]);
  const branches = [];
  for (let b = 0; b < 3; b++) { const i = 2 + Math.floor(rand(n - 4)); const [bx, by] = pts[i]; const br = [[bx, by]]; let cx = bx, cy = by; const dir = rand() < 0.5 ? -1 : 1; for (let s = 0; s < 4; s++) { cx += dir * rand(10, 30); cy += rand(15, 35); br.push([cx, cy]); } branches.push(br); }
  return { pts, branches };
}
export function drawBolt(ctx, b, a = 1) {
  if (STYLE.pixel) return pxBoltPath(ctx, b, a);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const [lw, col] of [[10, `rgba(170,150,255,${0.25 * a})`], [4, `rgba(230,220,255,${0.7 * a})`], [1.6, `rgba(255,255,255,${a})`]]) {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    for (const line of [b.pts, ...b.branches]) { ctx.beginPath(); line.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
    ctx.lineWidth = lw * 0.5;
  }
  ctx.restore();
}

// ---- искры костра, душа
export function drawSoul(ctx, x, y, r, a = 1, t = 0) {
  if (STYLE.pixel) return pxSoul(ctx, x, y, a, t);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, `rgba(255,250,235,${a})`); g.addColorStop(0.25, `rgba(255,220,170,${0.6 * a})`); g.addColorStop(1, 'rgba(255,160,90,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill();
  // хвост
  for (let i = 1; i < 8; i++) { ctx.globalAlpha = a * (1 - i / 8) * 0.5; ctx.beginPath(); ctx.arc(x + Math.sin(t * 4 + i) * 3, y + i * r * 0.9, r * (1 - i / 9), 0, TAU); ctx.fillStyle = '#ffd9a0'; ctx.fill(); }
  ctx.restore();
}

// ---- звёздное небо (фон меню и эпилога); стабильные звёзды по зерну
let stars = null;
export function drawSky(ctx, t, o = {}) {
  if (STYLE.pixel) { // ночь полосами палитры Flat, звёзды — пиксели по сетке, мерцают ступенькой
    for (const [y0, col] of [[0, '#07060c'], [180, '#0c0a12'], [320, '#140e16'], [440, '#1c1218']]) { ctx.fillStyle = col; ctx.fillRect(0, y0, W, H - y0); }
    for (let i = 0; i < 90; i++) { const sx = Math.round((Math.sin(i * 91.7) * 0.5 + 0.5) * W / 4) * 4, sy = Math.round((Math.sin(i * 37.3 + 1) * 0.5 + 0.5) * H * 0.75 / 4) * 4; if (Math.sin(t * 1.3 + i * 1.3) < -0.6) continue; ctx.fillStyle = i % 7 === 0 ? PAL.cream : PAL.grey; ctx.fillRect(sx, sy, i % 11 === 0 ? 4 : 2, i % 11 === 0 ? 4 : 2); }
    return;
  }
  stars ??= Array.from({ length: 160 }, (_, i) => ({ x: (Math.sin(i * 91.7) * 0.5 + 0.5) * W, y: (Math.sin(i * 37.3 + 1) * 0.5 + 0.5) * H * 0.75, r: 0.4 + (i % 7) * 0.18, p: i * 1.3 }));
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#07060c'); g.addColorStop(0.7, '#1a1016'); g.addColorStop(1, '#2a161b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const s of stars) { ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.3 + s.p); ctx.fillStyle = '#e8e2f0'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
}
// Созвездие сыновей: 8 звёзд + девятая (отец); при hercules=1 проступает фигура Геракла с палицей
export const CONSTELLATION = [[480, 92], [438, 128], [522, 126], [420, 182], [540, 180], [452, 238], [512, 240], [470, 296], [596, 108]];
const HERC_LINES = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 7], [2, 8]];
export function drawConstellation(ctx, t, lit, o = {}) {
  const ox = o.x ?? 0, oy = o.y ?? 0, sc = o.s ?? 1;
  const P = CONSTELLATION.map(([x, y]) => [ox + (x - 480) * sc + 480, oy + (y - 190) * sc + 190]);
  if (COS.stars.includes('eye')) eyeStar(ctx, ox + (372 - 480) * sc + 480, oy + (146 - 190) * sc + 190, sc, t);   // награда «Отцовский глаз»
  if (STYLE.pixel) { // пунктир по сетке, звёзды — крестики пикселей
    if (o.lines) { ctx.save(); ctx.globalAlpha *= Math.min(1, o.lines); for (const [a, b] of HERC_LINES) if (lit[a] && lit[b]) { const [x0, y0] = P[a], [x1, y1] = P[b], n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 12)); ctx.fillStyle = '#8a6a4a'; for (let i = 1; i < n; i++) ctx.fillRect(Math.round((x0 + (x1 - x0) * i / n) / 4) * 4, Math.round((y0 + (y1 - y0) * i / n) / 4) * 4, 4, 4); } ctx.restore(); }
    P.forEach(([x, y], i) => { if (lit[i]) { const big = Math.sin(t * 2 + i) > -0.3; pxIcon(ctx, ['.y.', 'yny', '.y.'], x, y, 4, { n: '#ffffff' }); if (big) pxIcon(ctx, ['...y...', '.......', '.......', 'y.....y', '.......', '.......', '...y...'], x, y, 4, { y: '#c88c1e' }); } else { ctx.fillStyle = PAL.grey2; ctx.fillRect(Math.round(x / 4) * 4, Math.round(y / 4) * 4, 4, 4); } });
    return;
  }
  if (o.lines) {
    ctx.save(); ctx.strokeStyle = `rgba(255,220,170,${0.35 * o.lines})`; ctx.lineWidth = 1.2; ctx.setLineDash([3, 5]);
    for (const [a, b] of HERC_LINES) if (lit[a] && lit[b]) { ctx.beginPath(); ctx.moveTo(...P[a]); ctx.lineTo(...P[b]); ctx.stroke(); }
    ctx.restore();
  }
  P.forEach(([x, y], i) => {
    const on = lit[i]; const pulse = 0.8 + 0.2 * Math.sin(t * 2 + i);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (on) { const g = ctx.createRadialGradient(x, y, 0, x, y, 16 * sc); g.addColorStop(0, `rgba(255,236,200,${0.9 * pulse})`); g.addColorStop(1, 'rgba(255,190,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16 * sc, 0, TAU); ctx.fill(); }
    ctx.fillStyle = on ? '#fff6e6' : 'rgba(200,190,200,0.25)'; ctx.beginPath(); ctx.arc(x, y, (on ? 2.6 : 1.4) * sc, 0, TAU); ctx.fill();
    ctx.restore();
  });
}
// «Око отца»: голубоватая звезда с четырьмя лучами чуть в стороне от созвездия
function eyeStar(ctx, x, y, sc, t) {
  const p = 0.75 + 0.25 * Math.sin(t * 1.7);
  if (STYLE.pixel) { pxIcon(ctx, ['...b...', '...b...', '..bwb..', 'bbwwwbb', '..bwb..', '...b...', '...b...'], x, y, 4, { b: p > 0.8 ? '#7fc8ff' : '#557ea9', w: '#ffffff' }); return; }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, 22 * sc); g.addColorStop(0, `rgba(190,225,255,${0.85 * p})`); g.addColorStop(1, 'rgba(120,170,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 22 * sc, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(210,235,255,${0.7 * p})`; ctx.lineWidth = 1.2; ctx.beginPath(); const L = 16 * sc * p; ctx.moveTo(x - L, y); ctx.lineTo(x + L, y); ctx.moveTo(x, y - L); ctx.lineTo(x, y + L); ctx.stroke();
  ctx.fillStyle = '#f4faff'; ctx.beginPath(); ctx.arc(x, y, 3 * sc, 0, TAU); ctx.fill(); ctx.restore();
}

// ---- знаки сыновей (простые геометрические гербы) — рисуются в квадрате радиуса r
export function drawGlyph(ctx, g, x, y, r, col = '#f2e6d6') {
  if (STYLE.pixel) return pxGlyph(ctx, g, x, y, r, col);
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1.4, r * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const b = () => ctx.beginPath();
  if (g === 'eye') { b(); ctx.ellipse(0, 0, r, r * 0.55, 0, 0, TAU); ctx.stroke(); b(); ctx.arc(0, 0, r * 0.28, 0, TAU); ctx.fill(); for (let i = 0; i < 5; i++) { const a = -Math.PI + i * Math.PI / 4; b(); ctx.moveTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.42 - r * 0.1); ctx.quadraticCurveTo(Math.cos(a) * r * 1.2, Math.sin(a) * r - r * 0.2, Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.1 - r * 0.3); ctx.stroke(); } }
  else if (g === 'horns') { b(); ctx.moveTo(-r * 0.25, r * 0.2); ctx.quadraticCurveTo(-r * 1.1, 0, -r * 0.8, -r * 0.9); ctx.stroke(); b(); ctx.moveTo(r * 0.25, r * 0.2); ctx.quadraticCurveTo(r * 1.1, 0, r * 0.8, -r * 0.9); ctx.stroke(); b(); ctx.ellipse(0, r * 0.35, r * 0.38, r * 0.5, 0, 0, TAU); ctx.fill(); }
  else if (g === 'wave') { for (const dy of [-0.35, 0.25]) { b(); for (let i = 0; i <= 20; i++) { const xx = -r + i * r / 10; ctx.lineTo(xx, dy * r + Math.sin(i / 20 * TAU * 1.5) * r * 0.25); } ctx.stroke(); } }
  else if (g === 'sun') { b(); ctx.arc(0, 0, r * 0.42, 0, TAU); ctx.fill(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; b(); ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); } }
  else if (g === 'snake') { b(); ctx.moveTo(-r * 0.6, r * 0.9); ctx.bezierCurveTo(r * 1.0, r * 0.6, -r * 1.0, -r * 0.1, r * 0.4, -r * 0.5); ctx.stroke(); b(); ctx.arc(r * 0.5, -r * 0.6, r * 0.2, 0, TAU); ctx.fill(); }
  else if (g === 'moon') { b(); ctx.arc(0, 0, r * 0.85, 0.35 * Math.PI, 1.65 * Math.PI); ctx.arc(r * 0.35, 0, r * 0.62, 1.55 * Math.PI, 0.45 * Math.PI, true); ctx.closePath(); ctx.fill(); }
  else if (g === 'star') { b(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
  else if (g === 'arrow') { b(); ctx.moveTo(-r * 0.8, r * 0.8); ctx.lineTo(r * 0.7, -r * 0.7); ctx.stroke(); b(); ctx.moveTo(r * 0.85, -r * 0.85); ctx.lineTo(r * 0.2, -r * 0.65); ctx.lineTo(r * 0.65, -r * 0.2); ctx.closePath(); ctx.fill(); b(); ctx.moveTo(-r * 0.8, r * 0.8); ctx.lineTo(-r * 0.85, r * 0.35); ctx.moveTo(-r * 0.8, r * 0.8); ctx.lineTo(-r * 0.35, r * 0.85); ctx.stroke(); }
  ctx.restore();
}
// Герб сына: круглый щит с ободом цвета гребня и знаком
export function drawBadge(ctx, son, x, y, r) {
  if (STYLE.pixel) return pxBadge(ctx, son, x, y, r);
  ctx.save();
  ctx.fillStyle = '#1a1214'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.lineWidth = r * 0.22; ctx.strokeStyle = son.crest; ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0, TAU); ctx.stroke();
  if (son.crest2 !== son.crest) { ctx.strokeStyle = son.crest2; ctx.setLineDash([r * 0.5, r * 0.5]); ctx.stroke(); ctx.setLineDash([]); }
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  drawGlyph(ctx, son.glyph, x, y, r * 0.48);
  ctx.restore();
}

// ---- Единый свет и цветокор сцены «чернила и дымка»: рисуется ПОСЛЕ фона, карт и костра, ДО интерфейса —
// так карты, фон и костёр лежат в одном свете (лиловая дымка, холодная луна сверху, тёплый огонь от костра).
// o: { fire: [x, y, сила 0..1], moon: сила, tint: цвет дымки, haze: сила дымки у земли }
export function gradeScene(ctx, o = {}) {
  if (STYLE.pixel) return; // плоская палитра Flat — без живописного света
  ctx.save();
  // общая дымка: умножение на пыльный лилово-бордовый — карты теряют «наклеенную» белизну
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = o.tint || '#cdb3b6'; ctx.globalAlpha = 1; ctx.fillRect(0, 0, W, H);
  // луна: холодный свет сверху-слева
  ctx.globalCompositeOperation = 'soft-light';
  const m = ctx.createRadialGradient(W * 0.22, -60, 40, W * 0.22, -60, H * 1.2); m.addColorStop(0, `rgba(200,210,255,${0.55 * (o.moon ?? 1)})`); m.addColorStop(1, 'rgba(40,30,60,0.35)');
  ctx.fillStyle = m; ctx.fillRect(0, 0, W, H);
  // огонь костра: тёплое пятно, «экран», чтобы подсвечивал ближние карты
  if (o.fire) {
    const [fx, fy, k] = o.fire; ctx.globalCompositeOperation = 'screen';
    const f = ctx.createRadialGradient(fx, fy, 0, fx, fy, 380); f.addColorStop(0, `rgba(255,140,60,${0.32 * k})`); f.addColorStop(0.5, `rgba(180,70,40,${0.12 * k})`); f.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = f; ctx.fillRect(0, 0, W, H);
  }
  // дымка у земли
  ctx.globalCompositeOperation = 'source-over';
  const h = ctx.createLinearGradient(0, H * 0.55, 0, H); h.addColorStop(0, 'rgba(60,40,48,0)'); h.addColorStop(1, `rgba(60,40,48,${0.35 * (o.haze ?? 1)})`);
  ctx.fillStyle = h; ctx.fillRect(0, H * 0.55, W, H * 0.45);
  ctx.restore();
}
// бумага и брызги туши по краям кадра — как в комиксе автора (брызги чернил у края панели)
let paper = null, inkFrame = null;
function makePaper() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { // волокна бумаги
    const px = Math.random() * 512, py = Math.random() * 512, l = 4 + Math.random() * 18, a = Math.random() * Math.PI;
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'; x.lineWidth = 0.6;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  for (let i = 0; i < 90; i++) { const px = Math.random() * 512, py = Math.random() * 512, r = 6 + Math.random() * 40, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.06)`); g.addColorStop(1, 'rgba(128,128,128,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
  return c;
}
function makeInkFrame() {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const g = x.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, H * 0.98);
  g.addColorStop(0, 'rgba(8,4,6,0)'); g.addColorStop(0.7, 'rgba(8,4,6,0.4)'); g.addColorStop(1, 'rgba(8,4,6,0.85)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(8,4,6,0.9)';
  for (let i = 0; i < 420; i++) { // брызги туши у краёв
    const side = Math.random(); let px, py;
    if (side < 0.25) { px = Math.random() * W; py = Math.random() * 40; } else if (side < 0.5) { px = Math.random() * W; py = H - Math.random() * 40; }
    else if (side < 0.75) { px = Math.random() * 50; py = Math.random() * H; } else { px = W - Math.random() * 50; py = Math.random() * H; }
    const r = Math.random() < 0.9 ? 0.6 + Math.random() * 2.2 : 3 + Math.random() * 6;
    x.globalAlpha = 0.25 + Math.random() * 0.6; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
  }
  return c;
}

// ---- виньетка + зерно (поверх кадра)
let vig = null, grain = null, gi = 0;
export function drawPost(ctx, o = {}) {
  if (!vig) {
    vig = document.createElement('canvas'); vig.width = W; vig.height = H; const c = vig.getContext('2d');
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(10,5,7,0)'); g.addColorStop(0.65, 'rgba(10,5,7,0.35)'); g.addColorStop(1, 'rgba(10,5,7,0.78)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  if (!STYLE.pixel) { ctx.drawImage(vig, 0, 0); inkFrame ??= makeInkFrame(); ctx.drawImage(inkFrame, 0, 0); }
  if (o.paper !== false && !STYLE.pixel) { paper ??= ctx.createPattern(makePaper(), 'repeat'); ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.22; ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  if (o.tint) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = o.tintA ?? 0.18; ctx.fillStyle = o.tint; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  if (!grain) {
    grain = [0, 1, 2].map(() => { const c = document.createElement('canvas'); c.width = c.height = 200; const x = c.getContext('2d'); const id = x.createImageData(200, 200); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (Math.random() * 2 - 1) * 46; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); return ctx.createPattern(c, 'repeat'); });
  }
  if (STYLE.pixel) return;
  gi = (gi + 1) % 6;
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.07; ctx.fillStyle = grain[gi >> 1];
  ctx.translate((Math.random() * 200) | 0, (Math.random() * 200) | 0); ctx.fillRect(-200, -200, W + 200, H + 200); ctx.restore();
}

// Амфора с водой (интерфейс внутри мира): терракота, чернофигурный пояс-меандр, уровень воды = глотки
export function drawAmphora(ctx, x, y, s, frac, n, low, t = 0) {
  if (STYLE.pixel) { pxAmphora(ctx, x, y, frac, low, s > 0.7 ? 8 : 4); if (n !== '') text(ctx, String(n), x + 40 * s, y + 6 * s, { size: 26 * s, color: low ? '#ff9a8a' : '#d8ecff' }); return; }
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const body = new Path2D('M-9 -46 L9 -46 L8 -38 C22 -32 30 -14 28 6 C26 26 14 40 5 46 L5 52 L-5 52 L-5 46 C-14 40 -26 26 -28 6 C-30 -14 -22 -32 -8 -38 Z');
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(2, 54, 22, 5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#9a4a2c'; ctx.fill(body);
  // вода внутри
  ctx.save(); ctx.clip(body); const lvl = 50 - 96 * Math.max(0, Math.min(1, frac));
  const wv = Math.sin(t * 3) * 1.5; ctx.fillStyle = low ? 'rgba(170,60,60,0.85)' : 'rgba(80,140,200,0.85)';
  ctx.beginPath(); ctx.moveTo(-40, lvl + wv); ctx.quadraticCurveTo(0, lvl - wv, 40, lvl + wv); ctx.lineTo(40, 60); ctx.lineTo(-40, 60); ctx.fill(); ctx.restore();
  // чернофигурный пояс с меандром
  ctx.save(); ctx.clip(body); ctx.fillStyle = '#1a0e0a'; ctx.fillRect(-32, -16, 64, 14);
  ctx.strokeStyle = '#c87a4a'; ctx.lineWidth = 1.4; ctx.beginPath(); for (let k = -30; k < 30; k += 8) { ctx.moveTo(k, -4); ctx.lineTo(k, -13); ctx.lineTo(k + 6, -13); ctx.lineTo(k + 6, -7); ctx.lineTo(k + 3, -7); } ctx.stroke(); ctx.restore();
  // ручки
  ctx.strokeStyle = '#7a3820'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-9, -40); ctx.bezierCurveTo(-22, -44, -24, -28, -20, -24); ctx.moveTo(9, -40); ctx.bezierCurveTo(22, -44, 24, -28, 20, -24); ctx.stroke();
  ctx.strokeStyle = 'rgba(20,8,4,0.8)'; ctx.lineWidth = 1.5; ctx.stroke(body);
  ctx.restore();
  if (n !== '') text(ctx, String(n), x + 40 * s, y + 6 * s, { size: 26 * s, sc: true, color: low ? '#ff9a8a' : '#d8ecff', stroke: 3 });
}
// Медальон дара: бронзовый диск с изображением, число — выбитое на ободе
export function drawMedallion(ctx, im, x, y, r, cnt, hov) {
  if (STYLE.pixel) { // ячейка дара: рамка (бронза, при наведении — золото), своя иконка 10×10, число в углу
    const src = im?.src || '', ic = src.includes('owl') ? 'owl' : src.includes('amphora') ? 'amph' : 'bolt';
    ctx.save(); pxPanel(ctx, x - r, y - r, r * 2, r * 2, { frame: hov ? PAL.gold : cnt > 0 ? '#a06e46' : '#4a3a30', fill: hov ? '#2a1a12' : PAL.table });
    ctx.globalAlpha = cnt > 0 ? 1 : 0.35; pxIcon(ctx, ic === 'amph' ? 'amphS' : ic, x, y - 2, 4); ctx.restore();
    text(ctx, String(cnt), x + r - 6, y + r - 8, { size: 16, color: cnt > 0 ? '#ffe0a8' : '#8d7a6d' }); return;
  }
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(x + 2, y + 3, r, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 2, x, y, r); g.addColorStop(0, hov ? '#f0c27a' : '#c99a56'); g.addColorStop(1, '#5a3a1a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, TAU); ctx.clip(); if (im) ctx.drawImage(im, x - r * 0.9, y - r * 1.35, r * 1.8, r * 2.8); ctx.restore();
  ctx.strokeStyle = 'rgba(40,20,8,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, TAU); ctx.stroke();
  if (cnt <= 0) { ctx.fillStyle = 'rgba(10,6,8,0.6)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  ctx.restore();
  text(ctx, String(cnt), x + r * 0.72, y + r * 0.62, { size: 17, color: '#ffe0a8', weight: 700, stroke: 3 });
}

// иконки HUD
export function iconDrop(ctx, x, y, r, full = true) {
  if (STYLE.pixel) return pxIcon(ctx, 'drop', x, y, r > 8 ? 4 : 2, full ? null : { c: PAL.grey2, w: PAL.grey2 });
  ctx.save(); ctx.beginPath(); ctx.moveTo(x, y - r); ctx.bezierCurveTo(x + r * 0.9, y - r * 0.1, x + r * 0.75, y + r * 0.8, x, y + r * 0.8);
  ctx.bezierCurveTo(x - r * 0.75, y + r * 0.8, x - r * 0.9, y - r * 0.1, x, y - r); ctx.closePath();
  ctx.fillStyle = full ? '#6fa8d8' : 'rgba(80,90,110,0.35)'; ctx.fill(); ctx.strokeStyle = full ? '#cfe6ff' : 'rgba(150,160,180,0.4)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
}
