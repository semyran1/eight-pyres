// Пиксельная версия («как Flat 2.2», ориентир — He Is Coming): сцены рисуются кодом попиксельно в 240×135
// (1 пиксель арта = 4 единицы экрана 960×540, как у карт 20×28 в масштабе 4). Живописные картинки здесь не используются.
// Палитра — из Flat 2.2: стол #101820, кремовый шлем, красный, коричневые щиты, голубая вода.
export const PW = 240, PH = 135, PS = 4;
const P = {
  table: '#101820', ink: '#000000', night1: '#0c1218', night2: '#16202c', night3: '#222c3c', dusk: '#2c1e2c',
  cream: '#f0f0dc', bone: '#c6d4e3', grey: '#737464', grey2: '#3a4250', red: '#c01b17', blood: '#6a0e0c',
  brown: '#a06e46', brown2: '#63442c', wood: '#7a5230', blue: '#00a0c8', blue2: '#557ea9', gold: '#ffc800',
  orange: '#f07818', body: '#2a2c38', fire: '#ffb040', green: '#2f5a3a', water: '#14304a', purple: '#3a2040',
};
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

function painter(w = PW, h = PH) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const px = (a, b, col) => { if (a < 0 || b < 0 || a >= w || b >= h) return; x.fillStyle = col; x.fillRect(a | 0, b | 0, 1, 1); };
  const rect = (a, b, rw, rh, col) => { x.fillStyle = col; x.fillRect(a | 0, b | 0, rw | 0, rh | 0); };
  const disc = (cx, cy, r, col) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r * 0.6) px(cx + i, cy + j, col); };
  const ring = (cx, cy, r, col) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const d = i * i + j * j; if (d <= r * r + r * 0.6 && d > (r - 1) * (r - 1) + (r - 1) * 0.6) px(cx + i, cy + j, col); } };
  const line = (x0, y0, x1, y1, col) => { x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; for (;;) { px(x0, y0, col); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } };
  // вертикальный градиент с упорядоченным дизерингом между соседними цветами
  const sky = (y0, y1, cols) => { for (let b = y0; b < y1; b++) { const t = (b - y0) / Math.max(1, y1 - y0 - 1) * (cols.length - 1), k = Math.min(cols.length - 2, Math.floor(t)), f = t - k; for (let a = 0; a < w; a++) px(a, b, f * 16 > BAYER[b & 3][a & 3] ? cols[k + 1] : cols[k]); } };
  const sprite = (rows, a, b, map, flip = false) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.' && map[ch]) px(flip ? a + r.length - 1 - i : a + i, b + j, map[ch]); }));
  return { c, x, px, rect, disc, ring, line, sky, sprite, w, h };
}

// ---- спрайты (символьные сетки)
// отец: коринфский шлем как у говорящего короля из Flat 2.2, гребень, тёмный плащ
const FATHER = [
  '.....rr.....', '....rrrr....', '.....cc.....', '...c.cc.c...', '..cicccci...', '.ccciiiiccc.', '.cccccccccc.', '.ci.cccc.ic.', '.ci..cc..ic.', '.ccc.cc.ccc.',
  '.ccci..iccc.', '..cc....cc..', '..kkkkkkkk..', '.kkkkkkkkkk.', 'kkkggkkggkkk', 'kkkkkkkkkkkk', 'kkkkkkkkkkkk', 'kk.kkkkkk.kk', 'kk.kkkkkk.kk', 'kk.kkkkkk.kk',
  'cc.kkkkkk.cc', '...kkkkkk...', '...kkkkkk...', '...kkkkkk...', '...kk..kk...', '...kk..kk...', '...kk..kk...', '..kkk..kkk..'];
const WOLF = ['k.........', 'kk.....kk.', '.kkkkkkkky', '.kkkkkkkkk', '.kkkkkkk..', '.k.k..k.k.'];
const SHEEP = ['.wwwww...', 'wwwwwwwkk', 'wwwwwwwkk', '.wwwwww..', '.k.k.k.k.'];
const SHIP = ['.......m........', '.......ms.......', '......ssss......', '.....sssss......', '....ssssss......', '.......m........', 'bbbbbbbbbbbbbbbb', '.bbbbbbbbbbbbbb.', '..bbbbbbbbbbbb..'];
const CHARON = ['..hh..', '.hhhh.', '.hkkh.', '.hhhh.', 'hhhhhh', 'hhhhhh', 'hhhhhh', '.hhhh.'];
const GATE = 16;
// павшие: лежащий воин со шлемом (мелкий — дальний план, крупный — ближний)
const BODY1 = ['.cc........', 'cccgkkkkkk.', '.cc.kkkkkkk', '....k.rk...'];
const BODY2 = ['..cc...........', '.cccc.bbb......', 'ccckgkbbbkkkkk.', '.cc.kkbbbkkkkkk', '.....k.r..k..k.'];

// ---- элементы сцены
function moon(p, cx, cy, r, col, crater) { p.disc(cx, cy, r, col); for (const [i, j, k] of [[-0.3, -0.2, 0.25], [0.25, 0.15, 0.18], [-0.05, 0.4, 0.14]]) p.disc(Math.round(cx + i * r), Math.round(cy + j * r), Math.max(1, Math.round(k * r)), crater); }
function stars(p, R, n, y1) { for (let i = 0; i < n; i++) p.px(Math.floor(R() * p.w), Math.floor(R() * y1), R() < 0.2 ? P.cream : P.grey); }
function hills(p, R, base, amp, col) { const f1 = 0.02 + R() * 0.02, f2 = 0.06 + R() * 0.05, o1 = R() * 9, o2 = R() * 9; for (let a = 0; a < p.w; a++) { const hgt = Math.round(base - amp * (0.6 * Math.sin(a * f1 + o1) + 0.4 * Math.sin(a * f2 + o2))); p.rect(a, hgt, 1, p.h - hgt, col); } }
// поле боя: тела, щиты, копья, шлемы — чем ближе, тем крупнее
function battlefield(p, R, y0, dense = 1) {
  p.sky(y0, p.h, [P.night2, P.night1, P.ink]);
  const n = Math.round(46 * dense);
  const items = []; for (let i = 0; i < n; i++) items.push({ x: Math.floor(R() * p.w), y: y0 + 2 + Math.floor(Math.pow(R(), 0.8) * (p.h - y0 - 4)), k: R() });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const s = 1 + (it.y - y0) / (p.h - y0) * 1.1, x = it.x, y = it.y;
    if (it.k < 0.32) { const big = s > 1.5; p.sprite(big ? BODY2 : BODY1, x - (big ? 7 : 5), y - (big ? 4 : 3), { c: P.cream, k: P.body, g: P.grey, b: P.brown2, r: P.blood }, it.k < 0.16); }
    else if (it.k < 0.56) { const r = Math.max(1, Math.round(1.8 * s)); p.disc(x, y - r, r, P.brown2); p.ring(x, y - r, r, P.brown); p.px(x, y - r, P.cream); }
    else if (it.k < 0.8) { const hgt = Math.round(7 * s), tilt = Math.round((R() - 0.5) * 6 * s); p.line(x, y, x + tilt, y - hgt, P.wood); p.px(x + tilt, y - hgt, P.grey); p.px(x + tilt, y - hgt - 1, P.bone); }
    else { const r = Math.max(1, Math.round(1.2 * s)); p.rect(x - r, y - r * 2, r * 2, r * 2, P.grey); p.rect(x - r, y - r, r * 2, 1, P.ink); if (R() < 0.4) p.px(x, y - r * 2 - 1, P.red); }
  }
}
function rainStreaks(p, R, n, col) { for (let i = 0; i < n; i++) { const x = Math.floor(R() * p.w), y = Math.floor(R() * p.h); p.rect(x, y, 1, 3, col); } }
function fogBands(p, R, y, col) { for (let b = y; b < y + 10; b++) for (let a = 0; a < p.w; a++) if (BAYER[b & 3][a & 3] < 5 - Math.abs(b - y - 5)) p.px(a, b, col); }
function pyre(p, cx, by, big) {
  const s = big ? 2 : 1;
  for (let i = 0; i < 4; i++) p.rect(cx - 9 * s + i * s, by - (i + 1) * 2 * s, (18 - i * 2) * s, 2 * s, i % 2 ? P.brown2 : P.wood);
  const fl = [[0, 14, P.orange], [-4, 10, P.orange], [4, 11, P.orange], [0, 9, P.fire], [-2, 6, P.fire], [2, 7, P.gold], [0, 4, P.cream]];
  for (const [dx, hgt, col] of fl) for (let j = 0; j < hgt * s; j++) { const wdt = Math.max(1, Math.round((hgt * s - j) / (3 * s) * s)); p.rect(cx + dx * s - wdt, by - 8 * s - j, wdt * 2, 1, col); }
}
function bolt(p, R, x0) { let x = x0, y = 0; while (y < p.h * 0.75) { const nx = x + Math.round((R() - 0.5) * 10), ny = y + 4 + Math.floor(R() * 6); p.line(x, y, nx, ny, P.cream); p.line(x + 1, y, nx + 1, ny, P.bone); x = nx; y = ny; } }

// ---- темы сцен по имени картинки
const THEME = {
  bg_moon1: 'night', bg_moon2: 'night', bg_moon3: 'night', bg_moon4: 'night', bg_valley: 'valley', p1_walk_field: 'walk', c_face: 'walk', c_kneel: 'kneel', c_kneel_tall: 'kneel',
  c_pray: 'bolt', c_bolt: 'bolt', bg_red: 'red', menu_a: 'menu', menu_b: 'menu', menu_c: 'menu', c_ares: 'red', c_phobos: 'red', c_alive: 'night',
  bg_door: 'door', c_styx: 'styx', c_pyre: 'fire', m3_lyre_fire: 'fire', p2_father_pyre: 'fire', t6_war_song: 'fire', t6_broken_lyre: 'fire',
  c_wolves: 'wolves', m1_boys_sheep: 'sheep', m2_herd_camp: 'sheep', t1_shore_sheep: 'sheep', bg_dawn: 'dawn', e1_cattle_return: 'dawn', m4_raid_dawn: 'dawn', c_club: 'dawn',
  t1_raiders_land: 'sea', t1_send_brother: 'sea', t1_chase_alone: 'sea', t3_boat_dawn: 'sea', t3_reeds_ambush: 'sea', t8_ships_leave: 'sea', t8_hide_brother: 'night',
  e2_alcmene_stars: 'stars', e3_souls_stars: 'stars',
};
export const isScene = n => /^(bg_|c_|menu_|t\d|m\d|e\d|p\d)/.test(n);
const cache = new Map();
export function pxScene(name) {
  if (cache.has(name)) return cache.get(name);
  const theme = THEME[name] || 'night', R = rng(hash(name)), p = painter();
  const hz = 70 + Math.floor(R() * 10);
  const nightSky = cols => { p.sky(0, hz + 8, cols); stars(p, R, 40, hz - 10); };
  switch (theme) {
    case 'red': case 'menu': {
      p.sky(0, hz + 8, [P.ink, P.blood, P.red]);
      moon(p, theme === 'menu' ? 150 : 60 + Math.floor(R() * 120), 42, theme === 'menu' ? 30 : 18, P.red, P.blood);
      hills(p, R, hz, 6, P.ink); battlefield(p, R, hz + 4, 1.1);
      if (theme === 'menu') p.sprite(FATHER, 150, hz + 4, { r: P.red, c: P.cream, i: P.ink, k: P.body, g: P.grey2 });
      break;
    }
    case 'door': {
      nightSky([P.ink, P.night1, P.purple]); hills(p, R, hz, 4, P.ink); battlefield(p, R, hz + 4, 0.7);
      const gx = 120, gy = hz - 2; p.rect(gx - 22, gy - 46, 44, 6, P.grey2); p.rect(gx - 20, gy - 40, 6, 42, P.grey2); p.rect(gx + 14, gy - 40, 6, 42, P.grey2);
      for (let j = 0; j < 40; j++) for (let i = 0; i < 28; i++) p.px(gx - 14 + i, gy - 40 + j, (BAYER[j & 3][i & 3] < 6 + j / 5) ? P.purple : P.ink);
      p.rect(gx - 20, gy - 40, 1, 42, P.grey); p.rect(gx + 14, gy - 40, 1, 42, P.grey); void GATE;
      break;
    }
    case 'styx': {
      p.sky(0, hz, [P.ink, P.night1, P.night2]); stars(p, R, 30, hz - 10);
      p.sky(hz, p.h, [P.water, P.night1, P.ink]);
      for (let i = 0; i < 60; i++) p.rect(Math.floor(R() * p.w), hz + 2 + Math.floor(R() * (p.h - hz)), 2 + Math.floor(R() * 4), 1, P.blue2);
      p.rect(96, hz + 18, 40, 3, P.brown2); p.rect(100, hz + 21, 32, 2, P.brown2); p.sprite(CHARON, 104, hz + 10, { h: P.grey2, k: P.gold }); p.line(112, hz + 6, 126, hz + 30, P.wood);
      for (let i = 0; i < 8; i++) p.disc(30 + i * 24 + Math.floor(R() * 8), hz - 18 - Math.floor(R() * 14), 1, P.bone);
      break;
    }
    case 'fire': {
      nightSky([P.ink, P.night1, P.dusk]); hills(p, R, hz, 5, P.ink); battlefield(p, R, hz + 4, 0.6);
      for (let r = 40; r > 0; r -= 8) for (let j = -r; j <= r; j++) for (let i = -r * 2; i <= r * 2; i++) if ((i * i) / 4 + j * j <= r * r && BAYER[(j + 64) & 3][(i + 64) & 3] < 2) p.px(120 + i, hz + 18 + j, P.brown2);
      pyre(p, 120, hz + 34, true);
      break;
    }
    case 'valley': { // луг для ночей-воспоминаний: живые волки и овцы рисуются поверх
      nightSky([P.ink, P.night1, P.night2]); moon(p, 186, 30, 16, P.red, P.blood); hills(p, R, hz - 2, 8, P.night1); hills(p, R, hz + 4, 4, P.ink);
      p.sky(hz + 8, p.h, [P.green, P.night2, P.ink]);
      for (let i = 0; i < 140; i++) { const x = Math.floor(R() * p.w), y = hz + 10 + Math.floor(R() * (p.h - hz - 10)); p.px(x, y, P.green); p.px(x, y - 1, R() < 0.5 ? P.green : P.night2); }
      break;
    }
    case 'wolves': case 'sheep': {
      nightSky([P.ink, P.night1, P.night2]); moon(p, 190, 28, 12, P.cream, P.bone); hills(p, R, hz, 8, P.green); p.sky(hz + 6, p.h, [P.green, P.night1, P.ink]);
      hills(p, R, hz + 14, 4, P.night1);
      const n = theme === 'wolves' ? 5 : 3; for (let i = 0; i < n; i++) p.sprite(WOLF, 20 + i * 44 + Math.floor(R() * 12), hz + 20 + Math.floor(R() * 30), { k: P.ink, y: P.gold }, i % 2 === 0);
      if (theme === 'sheep') for (let i = 0; i < 6; i++) p.sprite(SHEEP, 40 + i * 28 + Math.floor(R() * 8), hz + 34 + Math.floor(R() * 20), { w: P.cream, k: P.grey });
      break;
    }
    case 'dawn': {
      p.sky(0, hz + 8, [P.night2, P.dusk, P.orange, P.fire]); disc0(p, 180, hz + 4, 14, P.gold);
      hills(p, R, hz, 8, P.brown2); p.sky(hz + 6, p.h, [P.brown2, P.green, P.night1]);
      for (let i = 0; i < 7; i++) p.sprite(SHEEP, 20 + i * 30 + Math.floor(R() * 10), hz + 24 + Math.floor(R() * 26), { w: P.cream, k: P.ink });
      break;
    }
    case 'sea': {
      p.sky(0, hz, [P.night1, P.night2, P.dusk]); stars(p, R, 20, hz - 20);
      p.sky(hz, p.h, [P.water, P.night2, P.ink]);
      for (let i = 0; i < 50; i++) p.rect(Math.floor(R() * p.w), hz + 1 + Math.floor(R() * (p.h - hz)), 3 + Math.floor(R() * 5), 1, P.blue2);
      for (let i = 0; i < 3; i++) p.sprite(SHIP, 30 + i * 70 + Math.floor(R() * 20), hz - 8 + i * 6, { m: P.wood, s: P.red, b: P.brown2 });
      break;
    }
    case 'stars': {
      p.sky(0, p.h, [P.ink, P.night1, P.night2]); stars(p, R, 180, p.h);
      const pts = [[90, 30], [112, 40], [128, 34], [150, 46], [140, 66], [116, 70], [100, 58], [120, 54], [132, 90]];
      for (let i = 1; i < pts.length; i++) p.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], P.grey2);
      for (const [a, b] of pts) { p.disc(a, b, 1, P.gold); p.px(a, b, P.cream); }
      break;
    }
    case 'bolt': {
      nightSky([P.ink, P.night1, P.night3]); hills(p, R, hz, 5, P.ink); battlefield(p, R, hz + 4, 0.8); bolt(p, R, 120);
      p.sprite(FATHER, 115, hz + 8, { r: P.red, c: P.cream, i: P.ink, k: P.body, g: P.grey2 });
      break;
    }
    case 'walk': case 'kneel': {
      nightSky([P.ink, P.night1, P.night2]); moon(p, 60, 30, 14, P.red, P.blood); hills(p, R, hz, 6, P.ink); battlefield(p, R, hz + 4, 1);
      p.sprite(FATHER, 140, hz + 12, { r: P.red, c: P.cream, i: P.ink, k: P.body, g: P.grey2 }); rainStreaks(p, R, 60, P.grey2);
      break;
    }
    default: {
      const pale = R() < 0.5; nightSky([P.ink, P.night1, pale ? P.night3 : P.dusk]);
      moon(p, 30 + Math.floor(R() * 180), 20 + Math.floor(R() * 20), 9 + Math.floor(R() * 8), pale ? P.cream : P.red, pale ? P.bone : P.blood);
      hills(p, R, hz - 4, 7, P.night1); hills(p, R, hz, 5, P.ink); battlefield(p, R, hz + 4, 1);
      if (name.startsWith('bg_')) fogBands(p, R, hz - 2, P.grey2);
    }
  }
  p.c.__px = true; cache.set(name, p.c); return p.c;
}
function disc0(p, cx, cy, r, col) { p.disc(cx, cy, r, col); }

// ---- кадр в пиксельной сетке: сцена 240×135 всегда в масштабе 4; k = [cx, cy] — центр кадра в долях
export function drawPxScene(ctx, im, k, x, y, w, h) {
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const sw = Math.min(im.width, w / PS), sh = Math.min(im.height, h / PS);
  let sx = Math.round(k[0] * im.width - sw / 2), sy = Math.round(k[1] * im.height - sh / 2);
  sx = Math.max(0, Math.min(im.width - sw, sx)); sy = Math.max(0, Math.min(im.height - sh, sy));
  ctx.fillStyle = P.table; ctx.fillRect(x, y, w, h);
  ctx.drawImage(im, sx, sy, sw, sh, x + (w - sw * PS) / 2, y + (h - sh * PS) / 2, sw * PS, sh * PS);
  ctx.restore();
}

// ---- пиксельные спрайты интерфейса, нарисованные кодом
export function pxSprite(ctx, rows, x, y, s, map) { ctx.save(); rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.' && map[ch]) { ctx.fillStyle = map[ch]; ctx.fillRect(x + i * s, y + j * s, s, s); } })); ctx.restore(); }
export const PAL = P;
// бегущие волк и овца (два кадра ног), смотрят вправо
const WOLF_A = ['............k.k..', '............kkkk.', 'kk.........kkkekk', '.kkkkkkkkkkkkkkkk', '..kkkkkkkkkkkk...', '..kkkkkkkkkkk....', '..k..k.....k..k..', '.k....k...k....k.'];
const WOLF_B = ['............k.k..', '............kkkk.', 'kk.........kkkekk', '.kkkkkkkkkkkkkkkk', '..kkkkkkkkkkkk...', '..kkkkkkkkkkk....', '...k.k.....k.k...', '...k..k....k..k..'];
const SHEEP_A = ['..wwwwww....', '.wwwwwwwwkk.', 'wwwwwwwwwkek', 'wwwwwwwwwkk.', '.wwwwwwww...', '..k.k..k.k..', '..k.k..k.k..'];
const SHEEP_B = ['..wwwwww....', '.wwwwwwwwkk.', 'wwwwwwwwwkek', 'wwwwwwwwwkk.', '.wwwwwwww...', '.k...kk...k.', 'k.....k....k'];
export const SPR = { FATHER, WOLF, SHEEP, WOLF_A, WOLF_B, SHEEP_A, SHEEP_B };
// спрайт с отражением по горизонтали
export function pxSpriteFlip(ctx, rows, x, y, s, map, flip) { const wd = rows[0].length; ctx.save(); rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.' && map[ch]) { ctx.fillStyle = map[ch]; ctx.fillRect(x + (flip ? wd - 1 - i : i) * s, y + j * s, s, s); } })); ctx.restore(); }
// отрезок квадратами по сетке
export function pxLine(ctx, x0, y0, x1, y1, s, col) { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / s)); ctx.fillStyle = col; for (let i = 0; i <= n; i++) { const t = i / n; ctx.fillRect(Math.round((x0 + (x1 - x0) * t) / s) * s, Math.round((y0 + (y1 - y0) * t) / s) * s, s, s); } }
// костёр: языки пламени прямоугольниками по сетке
export function pxCampfire(ctx, x, y, t, s = 4) {
  ctx.save(); x = Math.round(x / s) * s; y = Math.round(y / s) * s;
  ctx.fillStyle = P.brown2; ctx.fillRect(x - 6 * s, y - s, 12 * s, s); ctx.fillStyle = P.wood; ctx.fillRect(x - 5 * s, y - 2 * s, 10 * s, s);
  const cols = [P.red, P.orange, P.fire, P.gold, P.cream];
  for (let i = 0; i < 5; i++) { const h = Math.round(7 - i + Math.sin(t * 9 + i * 1.7) * 1.5), w = 5 - i; ctx.fillStyle = cols[i];
    for (let j = 0; j < h; j++) { const ww = Math.max(1, Math.round(w * (1 - j / (h + 1)))), sh = Math.round(Math.sin(t * 7 + j + i) * 0.6); ctx.fillRect(x + (sh - ww) * s, y - (3 + j) * s, ww * 2 * s, s); } }
  ctx.restore();
}

// ==== [ВОЛКИ «НАВСТРЕЧУ»] блок агента волков (wolves.js): фронтальные звери из тумана, отец со спины, туман, земля.
// Звери смотрят в камеру, два кадра ног. Волк: k шерсть, g серая маска, w морда, r красные метки, p ухо, e глаз, i нос, t клыки.
const TW_WOLF = ['.k............k.', '.kk..........kk.', '.kpk........kpk.', '.kppkkkkkkkkppk.', 'kkkkkkkrrkkkkkkk', 'kggggkrrrrkggggk',
  'kgwwgkkrrkkgwwgk', 'kgeewgkkkkgweegk', 'kgrwwggggggwwrgk', '.kgrwwwggwwwrgk.', '..kgwwwwwwwwgk..', '...kgwwiiwwgk...', '...kkgwiiwgkk...',
  '..kkkktiitkkkk..', '.kkkkkkrrkkkkkk.', '.kkkkkkkkkkkkkk.', '...kk......kk...'];
// овца: c шерсть, b тень шерсти, f морда, p ухо, y глаз, i нос, k ноги
const TW_SHEEP = ['.....cccccc.....', '...cccbccbccc...', '..cccccccccccc..', '.cccccffffccccc.', 'fpcccffffffcccpf', 'ffcccfyffyfcccff',
  '.ccccffffffcccc.', 'cccccffiiffccccc', 'ccccccffffcccccc', '.cccccccccccccc.', '.bccccccccccccb.', '..cccccccccccc..', '...cccbbbbccc...', '....kk....kk....'];
// отец со спины: r гребень, c шлем, g тень шлема, k плащ, d складки
const TW_FATHER = ['......rr......', '.....rrrr.....', '.....rrrr.....', '....crrrrc....', '...ccrrrrcc...', '...cccrrccc...', '...cccccccc...', '...gccccccg...',
  '....kkkkkk....', '..kkkkkkkkkk..', '.kkkkkkkkkkkk.', 'kkkkkkkkkkkkkk', 'kkkdkkkkkkdkkk', 'kkkdkkkkkkdkkk', 'kkdkkkkkkkkdkk', 'kkdkkkkkkkkdkk', 'kdkkkkkkkkkkdk', 'kdkkkkkkkkkkdk'];
const TW_HEART = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
export const SPR_TW = {
  WOLF_A: [...TW_WOLF, '...kk...........', '...kk...........'], WOLF_B: [...TW_WOLF, '...........kk...', '...........kk...'],
  SHEEP_A: [...TW_SHEEP, '....kk....kk....', '....kk..........'], SHEEP_B: [...TW_SHEEP, '....kk....kk....', '..........kk....'],
  FATHER_BACK: TW_FATHER, HEART: TW_HEART,
};
const twCache = new Map();
// спрайт → холст «1 клетка = 1 пиксель» (масштаб drawImage без сглаживания, можно резать пополам); кэш по ключу
export function pxSpriteCanvas(rows, map, key) {
  const k = key + '|' + Object.entries(map).join(); let c = twCache.get(k); if (c) return c;
  const p = painter(rows[0].length, rows.length); p.sprite(rows, 0, 0, map); twCache.set(k, p.c); return p.c;
}
// полоса тумана с дизерингом Байера, бесшовная по горизонтали (для прокрутки); плотнее к середине
export function pxFogBank(w, h, col, seed = 1, dens = 9) {
  const k = 'fog|' + [w, h, col, seed, dens]; let c = twCache.get(k); if (c) return c;
  const p = painter(w, h), R = rng(seed), o1 = R() * 9, o2 = R() * 9;
  for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) {
    const d = dens * (1 - Math.abs(b - h / 2) / (h / 2)) * (0.75 + 0.3 * Math.sin(a / w * Math.PI * 6 + o1) + 0.2 * Math.sin(a / w * Math.PI * 14 + o2));
    if (BAYER[b & 3][a & 3] < d) p.px(a, b, col);
  }
  twCache.set(k, p.c); return p.c;
}
// земля от горизонта (top — строка в клетках 240×135) к зрителю: дизеринг + травинки, ближе — крупнее
export function pxGroundPlane(top) {
  const k = 'ground|' + top; let c = twCache.get(k); if (c) return c;
  const p = painter(PW, PH - top), R = rng(77);
  p.sky(0, p.h, [P.night2, P.night1, P.ink]);
  for (let i = 0; i < 260; i++) { const v = Math.pow(R(), 0.7), y = Math.floor(v * p.h), x = Math.floor(R() * p.w), hg = 1 + Math.round(v * 2.5); for (let j = 0; j < hg; j++) p.px(x, y - j, j === hg - 1 ? P.green : P.night2); }
  twCache.set(k, p.c); return p.c;
}
// ---- v2 (тренажёр реакции): силуэты из тумана, туман-поле, пятно света. Силуэт один на обоих зверей (волк и овца неразличимы).
// k — тело, d — край (дизер шашкой). Два варианта (уши торчком / бугристая спина), ноги стоят — прыжок и рывок рисует сцена.
const dither = rows => rows.map((r, j) => [...r].map((ch, i) => ch === 'd' ? ((i + j) & 1 ? '.' : 'd') : ch).join(''));
const TW_SHADE_A = ['..d..........d..', '..kk........kk..', '..kkkkkkkkkkkk..', '.dkkkkkkkkkkkkd.', '.kkkkkkkkkkkkkk.', '.kkkkkkkkkkkkkk.', 'dkkkkkkkkkkkkkkd', 'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'dkkkkkkkkkkkkkkd', '.kkkkkkkkkkkkkk.', '.dkkkkkkkkkkkkd.', '..dkkkkkkkkkkd..', '...kk......kk...', '...kk......kk...', '...dd......dd...'];
const TW_SHADE_B = ['................', '.....dkkkkd.....', '....kkkkkkkk....', '..d.kkkkkkkk.d..', '.dkkkkkkkkkkkkd.', '.kkkkkkkkkkkkkk.', 'dkkkkkkkkkkkkkkd', 'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk', 'dkkkkkkkkkkkkkkd', '.kkkkkkkkkkkkkk.', '.dkkkkkkkkkkkkd.', '..dkkkkkkkkkkd..', '...kk......kk...', '...kk......kk...', '...kk......kk...', '...dd......dd...'];
SPR_TW.SHADE_A = dither(TW_SHADE_A); SPR_TW.SHADE_B = dither(TW_SHADE_B);
// туман-поле: дизер Байера, плотный сверху и редкий внизу, бесшовный по горизонтали (прокручивать); dens 0…16
export function pxFogField(w, h, col, seed = 1, dens = 10) {
  const k = 'fogf|' + [w, h, col, seed, dens]; let c = twCache.get(k); if (c) return c;
  const p = painter(w, h), R = rng(seed), o1 = R() * 9, o2 = R() * 9;
  for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) {
    const v = 1 - b / h, d = dens * v * v * (0.7 + 0.3 * Math.sin(a / w * Math.PI * 8 + o1) + 0.2 * Math.sin(a / w * Math.PI * 18 + o2));
    if (BAYER[b & 3][a & 3] < d) p.px(a, b, col);
  }
  twCache.set(k, p.c); return p.c;
}
// пятно света факела на земле: tops[x] — верхняя строка круга в столбце x (клетки 240×135); дизер гуще к отцу, тёплый у низа
export function pxLightPool(tops, key) {
  const k = 'pool|' + key; let c = twCache.get(k); if (c) return c;
  const p = painter(PW, PH);
  for (let a = 0; a < PW; a++) {
    const t = tops[a] | 0;
    for (let b = t; b < PH; b++) {
      const v = (b - t) / Math.max(1, PH - t), d = 15 * Math.pow(v, 0.75);
      if (BAYER[b & 3][a & 3] < d) p.px(a, b, v > 0.55 ? '#4a3020' : P.dusk);
    }
  }
  twCache.set(k, p.c); return p.c;
}
// ==== [/ВОЛКИ «НАВСТРЕЧУ»]

// ---- интерфейс по пиксельной сетке: иконки, гербы, щиты, лира (общие для поля, памяти, меню, смерти).
// Всё рисуется квадратами s×s (s = 4 — пиксель арта; 2 — только для мелочей HUD) с привязкой к сетке.
const snapTo = (v, s) => Math.round(v / s) * s;
const IC = { k: P.table, K: P.ink, w: P.cream, e: P.bone, g: P.grey, G: P.grey2, y: P.gold, Y: '#c88c1e', o: P.orange, r: P.red, R: P.blood,
  b: P.brown, B: P.brown2, t: '#be5a32', T: '#7a3820', c: P.blue, C: P.blue2, f: P.fire, d: '#2a1810', v: '#c8c0ff', n: '#ffe08a' };
export const ICON = {
  owl: ['.w......w.', '.wwwwwwww.', 'wwyywwyyww', 'wykywwykyw', 'wwyywwyyww', '.wwwoowww.', '.wwwwwwww.', '.wgwwwwgw.', '..wwwwww..', '..o....o..'],
  bolt: ['....nny', '...nny.', '..nny..', '.nnyyyy', 'nnnnyy.', '...yy..', '..yy...', '.yy....', 'yy.....'],
  amph: ['..ttttt..', '...tTt...', 'tt.tTt.tt', 't.tTTTt.t', 't.tTTTt.t', '.ttTTTtt.', 'ttTTTTTtt', 'tTTTTTTTt', 'tTTTTTTTt', '.tTTTTTt.', '..tTTTt..', '...ttt...', '..ttttt..'],
  amphS: ['..ttttt..', '...tTt...', 'tt.tTt.tt', 't.ttttt.t', '.ttKKKtt.', 'ttttttttt', 'tTtTtTtTt', '.ttttttt.', '..ttttt..', '...ttt...'],
  drop: ['..c..', '.ccc.', '.ccc.', 'ccccc', 'cwccc', 'ccccc', '.ccc.'],
  cloud: ['...eee.....', '..eeeee.ee.', '.eeeeeeeeee', 'eeeeeeeeeee', 'GeeeeeeeeeG', '.GGGGGGGGG.'],
  lock: ['..eee..', '.e...e.', '.e...e.', 'ooooooo', 'oooKooo', 'oooKooo', 'ooooooo'],
  check: ['......y', '.....yy', 'y...yy.', 'yy.yy..', '.yyy...', '..y....'],
  star: ['...y...', '..yyy..', 'yyyyyyy', '.yyyyy.', '..yyy..', '.yy.yy.', 'yy...yy'],
  starOff: ['...G...', '..GGG..', 'GGGGGGG', '.GGGGG.', '..GGG..', '.GG.GG.', 'GG...GG'],
  cross: ['rr...rr', '.rr.rr.', '..rrr..', '..rrr..', '.rr.rr.', 'rr...rr'],
  shard: ['..w..', '.wew.', 'wewew', '.wew.', '..w..'],
  skull: ['.eeeee.', 'eeeeeee', 'eKKeKKe', 'eKKeKKe', 'eeeKeee', '.eeeee.', '.e.e.e.'],
  helm: ['...rr...', '..rrrr..', '..wwww..', '.wwwwww.', 'wwKKKKww', 'ww.ww.ww', 'ww.ww.ww', 'w..ww..w'],
  bird0: ['KK.....KK', '.KK...KK.', '..KKKKK..', '....KKK.K'],
  bird1: ['.........', '...KKK...', '.KKKKKKK.', 'KK..K..KK'],
};
// иконка по центру (cx, cy); s — размер пикселя; map — свои цвета
export function pxIcon(ctx, name, cx, cy, s = 4, map = null, flip = false) {
  const rows = ICON[name] || name; if (!rows || !rows.length) return;
  const w = rows[0].length * s, h = rows.length * s;
  pxSpriteFlip(ctx, rows, snapTo(cx - w / 2, s), snapTo(cy - h / 2, s), s, map ? { ...IC, ...map } : IC, flip);
}
// круг/кольцо по сетке (r — в логических единицах)
export function pxDisc(ctx, cx, cy, r, col, s = 4) { const R = Math.max(1, Math.round(r / s)); cx = snapTo(cx, s); cy = snapTo(cy, s); ctx.fillStyle = col; for (let j = -R; j < R; j++) { const half = Math.round(Math.sqrt(R * R - (j + 0.5) * (j + 0.5))); ctx.fillRect(cx - half * s, cy + j * s, half * 2 * s, s); } }
export function pxRing(ctx, cx, cy, r, col, s = 4, wpx = 1) {
  const R = Math.max(1, Math.round(r / s)), R2 = R - wpx; cx = snapTo(cx, s); cy = snapTo(cy, s); ctx.fillStyle = col;
  for (let j = -R; j < R; j++) { const y = j + 0.5, ho = Math.round(Math.sqrt(R * R - y * y)), hi = Math.abs(y) < R2 ? Math.round(Math.sqrt(R2 * R2 - y * y)) : 0; ctx.fillRect(cx - ho * s, cy + j * s, (ho - hi) * s, s); ctx.fillRect(cx + hi * s, cy + j * s, (ho - hi) * s, s); }
}
// рамка в 1 пиксель арта со срезанными углами (как панели He Is Coming)
export function pxFrame(ctx, x, y, w, h, col, s = 4) { x = snapTo(x, s); y = snapTo(y, s); w = snapTo(w, s); h = snapTo(h, s); ctx.fillStyle = col; ctx.fillRect(x + s, y, w - 2 * s, s); ctx.fillRect(x + s, y + h - s, w - 2 * s, s); ctx.fillRect(x, y + s, s, h - 2 * s); ctx.fillRect(x + w - s, y + s, s, h - 2 * s); }
export function pxPanel(ctx, x, y, w, h, o = {}) {
  const s = 4; x = snapTo(x, s); y = snapTo(y, s); w = snapTo(w, s); h = snapTo(h, s);
  ctx.fillStyle = o.fill || P.table; ctx.fillRect(x + s, y + s, w - 2 * s, h - 2 * s);
  pxFrame(ctx, x, y, w, h, o.frame || '#d8ccb8', s);
  ctx.fillStyle = o.shade || 'rgba(0,0,0,0.35)'; ctx.fillRect(x + s, y + h - 2 * s, w - 2 * s, s);   // тень под нижней кромкой — объём
}
// знаки сыновей 9×9 (глаз и волна — 9×7): крупнее и проще, чтобы читались на щите любого размера
export const GLYPH = {
  eye: ['..#####..', '.#.....#.', '#..###..#', '#..###..#', '#..###..#', '.#.....#.', '..#####..'],
  horns: ['#.......#', '#.......#', '##.....##', '.##...##.', '..#####..', '..#####..', '..#.#.#..', '...###...', '....#....'],
  wave: ['.........', '.##...##.', '#..#.#..#', '....#....', '.##...##.', '#..#.#..#', '....#....'],
  sun: ['....#....', '.#..#..#.', '..#####..', '..#####..', '#########', '..#####..', '..#####..', '.#..#..#.', '....#....'],
  snake: ['..####.#.', '.#....#..', '.#.......', '..##.....', '....###..', '.......#.', '.......#.', '.#.....#.', '..#####..'],
  moon: ['...####..', '..##.....', '.##......', '##.......', '##.......', '##.......', '.##......', '..##.....', '...####..'],
  star: ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '##.....##'],
  arrow: ['.....####', '.......##', '......#.#', '.....#..#', '....#....', '...#.....', '#.#......', '.##......', '###......'],
};
export function pxGlyph(ctx, g, x, y, r, col = P.cream) { const s = Math.max(2, Math.round(2 * r / 9 / 2) * 2); pxIcon(ctx, GLYPH[g] || GLYPH.star, x, y, s, { '#': col }); }
// герб сына: круглый щит, обод цвета гребня (второй цвет — через пиксель), знак; кэш по размеру
const badgeCache = new Map();
export function pxBadge(ctx, son, x, y, r) {
  const s = r >= 14 ? 4 : 2; let D = Math.max(11, Math.round(2 * r / s)); if (D % 2 === 0) D++;
  const key = son.glyph + son.crest + son.crest2 + D; let c = badgeCache.get(key);
  if (!c) {
    const p = painter(D, D), R = D / 2, ring = D >= 15 ? 2 : 1, k = Math.max(1, Math.floor(D * 0.66 / 9));
    for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) {
      const d = Math.hypot(i + 0.5 - R, j + 0.5 - R); if (d > R) continue;
      const two = son.crest2 && son.crest2 !== son.crest && ((i + j) & 2);
      p.px(i, j, d > R - 1 ? P.ink : d > R - 1 - ring ? (two ? son.crest2 : son.crest) : '#1a1214');
    }
    const g = GLYPH[son.glyph] || GLYPH.star, ox = Math.floor((D - g[0].length * k) / 2), oy = Math.floor((D - g.length * k) / 2);
    g.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') p.rect(ox + i * k, oy + j * k, k, k, '#f2e6d6'); }));
    c = p.c; badgeCache.set(key, c);
  }
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(c, snapTo(x - D * s / 2, s), snapTo(y - D * s / 2, s), D * s, D * s); ctx.restore();
}
// амфора HUD: уровень воды по рядам «T» (внутренность)
export function pxAmphora(ctx, x, y, frac, low, s = 4) {
  const rows = ICON.amph, inner = [], n = rows.length;
  rows.forEach((r, j) => { if (r.includes('T')) inner.push(j); });
  const lvl = Math.round(inner.length * Math.max(0, Math.min(1, frac))), wet = new Set(inner.slice(inner.length - lvl));
  const w = rows[0].length * s, x0 = snapTo(x - w / 2, s), y0 = snapTo(y - n * s / 2, s);
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') return; ctx.fillStyle = ch === 'T' ? (wet.has(j) ? (low ? P.red : P.blue) : '#2a1810') : IC[ch]; ctx.fillRect(x0 + i * s, y0 + j * s, s, s); }));
}
// лира «Плача»: рога по кривой, перекладина, панцирь, струны в пиксель арта; o = { xs, y0, y1, lit, litK, hover, cols, t }
export function pxLyre(ctx, o) {
  const s = 4, { xs, y0, y1 } = o, xl = xs[0] - 46, xr = xs[xs.length - 1] + 46;
  const horn = (side, x0) => {
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, u = 1 - t;
      const X = u * u * u * (x0 - side * 6) + 3 * u * u * t * (x0 + side * 46) + 3 * u * t * t * (x0 + side * 54) + t * t * t * (x0 + side * 4);
      const Y = u * u * u * (y1 + 26) + 3 * u * u * t * (y1 - 40) + 3 * u * t * t * (y0 + 40) + t * t * t * (y0 - 34); pts.push([X, Y]); }
    for (const [lw, col] of [[4, P.brown2], [2, '#c9954f']]) { ctx.fillStyle = col; for (const [X, Y] of pts) ctx.fillRect(snapTo(X, s) - (lw >> 1) * s, snapTo(Y, s) - (lw >> 1) * s, lw * s, lw * s); }
    ctx.fillStyle = '#e8c27a'; ctx.fillRect(snapTo(x0 + side * 4, s) - s, snapTo(y0 - 38, s) - s, 3 * s, 3 * s);
  };
  horn(-1, xl); horn(1, xr);
  ctx.fillStyle = P.brown2; ctx.fillRect(snapTo(xl - 8, s), snapTo(y0 - 18, s), snapTo(xr - xl + 16, s), 3 * s);
  ctx.fillStyle = '#8a5a2c'; ctx.fillRect(snapTo(xl - 8, s), snapTo(y0 - 18, s), snapTo(xr - xl + 16, s), 2 * s);
  // панцирь черепахи: эллипс, щитки — тёмные кольца
  const bx = 480, by = snapTo(y1 + 30, s), RX = 37, RY = 9;
  for (let j = -RY; j < RY; j++) { const half = Math.round(RX * Math.sqrt(1 - ((j + 0.5) / RY) ** 2)); ctx.fillStyle = j < -RY + 2 ? '#9a6a3a' : j > RY - 3 ? '#2e1c10' : '#6a4426'; ctx.fillRect(bx - half * s, by + j * s, half * 2 * s, s); }
  for (let k = -2; k <= 2; k++) pxRing(ctx, bx + k * 48, by, 20, '#3a2414', s);
  xs.forEach((x, i) => {
    const lit = o.lit === i && o.litK > 0, col = o.cols[i], top = snapTo(y0 - 14, s);
    if (o.hover === i) { ctx.fillStyle = 'rgba(255,220,160,0.12)'; ctx.fillRect(snapTo(x - 28, s), snapTo(y0 - 10, s), 56, snapTo(y1 - y0 + 30, s)); }
    const vib = lit ? Math.round(Math.sin(o.t * 80) * o.litK * 4) * s : 0, xb = x, n = Math.round((y1 + 22 - (y0 - 14)) / s);
    const sx = k => snapTo(x + (xb - x) * k / n + Math.sin(k / n * Math.PI) * vib, s);
    if (lit) { ctx.fillStyle = col; for (let k = 0; k <= n; k++) ctx.fillRect(sx(k) - s, top + k * s, 3 * s, s); }
    ctx.fillStyle = lit ? '#fff2c0' : '#e3d6bc'; for (let k = 0; k <= n; k++) ctx.fillRect(sx(k), top + k * s, s, s);
    const pr = lit ? 3 : 2, px0 = snapTo(x, s);
    ctx.fillStyle = P.ink; ctx.fillRect(px0 - pr * s, top - pr * s, (2 * pr + 1) * s, (2 * pr + 1) * s);
    ctx.fillStyle = col; ctx.fillRect(px0 - (pr - 1) * s, top - (pr - 1) * s, (2 * pr - 1) * s, (2 * pr - 1) * s);
  });
}
// душа над костром: светлое ядро, ореол, хвост
export function pxSoul(ctx, x, y, a, t) {
  const s = 4; ctx.save(); x = snapTo(x, s); y = snapTo(y, s);
  for (let i = 1; i <= 4; i++) { ctx.globalAlpha = a * (1 - i / 6); ctx.fillStyle = [P.gold, P.fire, P.orange, P.red][i - 1]; ctx.fillRect(x + Math.round(Math.sin(t * 4 + i)) * s, y + (i + 1) * s, s, s); }
  ctx.globalAlpha = a; ctx.fillStyle = P.fire; ctx.fillRect(x - 2 * s, y - s, 5 * s, 3 * s); ctx.fillRect(x - s, y - 2 * s, 3 * s, 5 * s);
  ctx.fillStyle = P.cream; ctx.fillRect(x - s, y - s, 3 * s, 3 * s); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, s, s);
  ctx.restore();
}
// молния: ломаная квадратами — голубой край и белое ядро
export function pxBoltPath(ctx, b, a = 1) {
  ctx.save(); ctx.globalAlpha *= a;
  for (const line of [b.pts, ...b.branches]) for (let i = 1; i < line.length; i++) { pxLine(ctx, line[i - 1][0] - 4, line[i - 1][1], line[i][0] - 4, line[i][1], 4, P.blue2); pxLine(ctx, line[i - 1][0] + 4, line[i - 1][1], line[i][0] + 4, line[i][1], 4, P.blue2); }
  for (const line of [b.pts, ...b.branches]) for (let i = 1; i < line.length; i++) pxLine(ctx, line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], 4, '#ffffff');
  ctx.restore();
}
// птица (ворон) — два кадра взмаха
export function pxBird(ctx, x, y, ph, dir, s = 4) { pxIcon(ctx, Math.sin(ph) > 0 ? 'bird0' : 'bird1', x, y, s, null, dir < 0); }
// частицы (искры, брызги, звёзды) — квадратами по сетке 2 или 4, без сглаженных кругов
export function pxParticles(ctx, parts) {
  ctx.save();
  for (const q of parts.p) {
    if (!q.alive) continue;
    const k = q.t / q.life, sz = q.size + (q.size2 - q.size) * k, s = sz > 2.5 ? 4 : 2;
    ctx.globalAlpha = q.alpha * (1 - k * k); ctx.fillStyle = q.color;
    const x = snapTo(q.x, s), y = snapTo(q.y, s);
    if (q.shape === 'ring') { const r = Math.max(s, snapTo(sz, s)); ctx.fillRect(x - r, y - r, 2 * r, s); ctx.fillRect(x - r, y + r - s, 2 * r, s); ctx.fillRect(x - r, y - r, s, 2 * r); ctx.fillRect(x + r - s, y - r, s, 2 * r); }
    else if (q.shape === 'star' && sz > 3) { ctx.fillRect(x - s, y, 3 * s, s); ctx.fillRect(x, y - s, s, 3 * s); }
    else ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}
