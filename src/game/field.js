// Поле мёртвых: поиск пар с порядком обряда (ноу-хау NO Flat 1.5), жажда вместо таймера, угрозы Ареса,
// дары богов, костёр с молнией и душой сына. Одна сцена на все поля кампании — различия в data.js.
import { FIELDS, CARDS, SONS, LINES, LINE_CD, FIELD_INTRO } from './data.js';
import { tr } from './i18n.js';
import { STYLE, img, W, H, text, wrap, button, comicBox, drawCam, Rain, Fog, boltPath, drawBolt, drawSoul, drawBadge, drawPost, iconDrop, drawConstellation, gradeScene, drawAmphora, drawMedallion, measure } from '../art/gfx.js';
import { sfx, setAmbient, playMusic, setDrone } from '../engine/audio.js';
import { setMood } from '../engine/score.js';
import { rand, pick, shuffle, clamp, ease, Particles, TAU, lerp } from '../engine/util.js';
import { drawDialog, drawPause, starIcon, pauseButton } from './ui.js';
import { runMods, noteFail, clearFail } from './meta.js';
import { pxIcon, pxLyre, pxBird, pxRing, pxParticles, pxPanel } from '../art/pixel.js';

const BOARD = { x: 14, y: 66, w: 668, h: 462 };
const TELE = 0.85; // знак перед перестановкой (ворон, пёс, Деймос): столько секунд видно, что и куда поедет
const aspect = () => STYLE.pixel ? 20 / 28 : 232 / 364;
const RITUAL = ['helm', 'shield', 'spears', 'coin', 'bolt'];
// облик карты: одинаковые на вид карты всегда пара (тип + знак на шлеме); имя ↔ щит сына — по сыну
export const vkey = d => d.type === 'name' || d.type === 'sshield' ? 'son' + d.son : d.type + (d.badge ? ':' + d.badge.crest + d.badge.crest2 + d.badge.glyph : '');
const GIFTS = [
  { id: 'gaze', name: 'Взор Афины', img: 'card_owl', tip: 'Открыть одну карту бесплатно' },
  { id: 'flash', name: 'Вспышка Зевса', img: 'card_bolt', tip: 'Осветить всё поле на миг' },
  { id: 'amph', name: 'Амфора Деметры', img: 'card_amphora', tip: '+4 глотка' },
];

export function createField(app) {
  let S = null;
  const parts = new Particles(500);
  const rain = new Rain(240), fog = new Fog();

  // сетка с самыми крупными картами для n карт
  function gridFor(n) {
    let best = null;
    for (let rows = 2; rows <= 5; rows++) {
      const cols = Math.ceil(n / rows); if (cols * rows - n >= cols) continue;
      const g = STYLE.pixel ? 4 : rows >= 4 ? 9 : 12; let ch = Math.min((BOARD.h - (rows - 1) * g) / rows, ((BOARD.w - (cols - 1) * g) / cols) / aspect());
      if (STYLE.pixel) ch = 28 * Math.max(2, Math.floor(ch / 28 / 2) * 2);
      // при равном размере карт — меньше пустых мест, затем меньше рядов (шире, как стол Flat 2.2)
      const empty = cols * rows - n;
      if (!best || ch > best.ch + 0.5 || (Math.abs(ch - best.ch) <= 0.5 && (empty < best.empty || (empty === best.empty && rows < best.rows)))) best = { cols, rows, ch, empty };
    }
    return [best.cols, best.rows];
  }
  function layout(cols, rows, n = cols * rows) {
    const g = STYLE.pixel ? 4 : rows >= 4 ? 9 : 12;
    const A = aspect(); let ch = Math.min((BOARD.h - (rows - 1) * g) / rows, ((BOARD.w - (cols - 1) * g) / cols) / A);
    // пиксельная версия: карта 20×28 в целом масштабе (пиксель спрайта = 4 единицы, как у сцен), всё по сетке
    if (STYLE.pixel) ch = 28 * Math.max(2, Math.floor(ch / 28 / 2) * 2);
    const cw = ch * A;
    const tw = cols * cw + (cols - 1) * g, th = rows * ch + (rows - 1) * g;
    let ox = BOARD.x + (BOARD.w - tw) / 2, oy = BOARD.y + (BOARD.h - th) / 2;
    if (STYLE.pixel) { ox = Math.round(ox / 4) * 4; oy = Math.round(oy / 4) * 4; }
    const slots = [];
    // неполный последний ряд — по центру
    for (let r = 0; r < rows; r++) { const inRow = r === rows - 1 ? n - cols * (rows - 1) : cols, sx = ox + (cols - inRow) * (cw + g) / 2;
      for (let c = 0; c < cols; c++) slots.push({ x: (c < inRow ? sx : ox) + c * (cw + g) + cw / 2, y: oy + r * (ch + g) + ch / 2, r, c }); }
    return { cw, ch, slots, n };
  }

  function buildDeck(def, pairs, pid0 = 0) {
    const deck = []; let pid = pid0;
    const others = SONS.map((s, i) => i).filter(i => i !== def.son);
    shuffle(others);
    // чужой шлем: герб похож на герб сына — тот же знак другого цвета или тот же цвет с другим знаком
    const target = def.son != null ? SONS[def.son] : null;
    const glyphs = ['eye', 'horns', 'wave', 'sun', 'snake', 'moon', 'star', 'arrow'].filter(g => g !== target?.glyph);
    const colors = ['#c8102e', '#efe6d2', '#2f6db5', '#e0a526', '#3f9a52', '#7e3fa0', '#b8632f', '#c9ced6'].filter(c => c !== target?.crest);
    shuffle(glyphs); shuffle(colors);
    for (const [type, n] of Object.entries(pairs)) {
      if (type === 'assoc') { for (const sn of n) { deck.push({ type: 'name', son: sn, pid }, { type: 'sshield', son: sn, pid }); pid++; } continue; }
      for (let k = 0; k < n; k++) {
        const son = type === 'helm' ? def.son : null;
        let badge = type === 'helm' && target ? target : null;
        if (type === 'decoy' && target) badge = k % 2 === 0 ? { crest: target.crest, crest2: target.crest2, glyph: glyphs[k] } : { crest: colors[k], crest2: colors[k], glyph: target.glyph };
        deck.push({ type, son, pid, badge }, { type, son, pid, badge }); pid++;
      }
    }
    return shuffle(deck);
  }

  function makeCards(deck, L, deal) {
    return deck.map((d, i) => {
      const s = L.slots[i];
      return { i, ...d, key: vkey(d), slot: i, x: s.x, y: deal ? s.y + 420 : s.y, face: 0, open: false, matched: false, gone: false, lift: 0, shake: 0, alpha: 1, glow: 0, seen: false, vis: false, peek: 0, hint: 0, reject: 0, fly: null,
        move: deal ? { x0: s.x, y0: s.y + 420, x1: s.x, y1: s.y, t: -i * 0.05, dur: 0.55 } : null };
    });
  }
  // «дымка» (Гнев Ареса): в показе видна лишь часть карт — случайные индексы
  function pickSet(n, frac) { const idx = shuffle([...Array(n).keys()]); return new Set(idx.slice(0, Math.max(1, Math.round(n * frac)))); }
  function totalPairs(def, type) { return def.layers.reduce((a, l) => a + (l[type] || 0), 0); }
  function newState(id, keepTries) {
    const def = FIELDS[id], up = app.save.up || {};
    // алтарь (свет/тень) и знамение — модификаторы поля (meta.js); обучение и имена — без них
    const M = def.tutorial || def.assoc ? runMods({ up: {}, side: {} }, id) : runMods(app.save, id);
    const pairs0 = { ...def.layers[0] };
    if (!def.assoc) for (const [k, v] of Object.entries(M.pairs)) if (k !== 'decoy' || def.son != null) pairs0[k] = (pairs0[k] || 0) + v;
    const n0 = Object.entries(pairs0).reduce((a, [k, v]) => a + (k === 'assoc' ? v.length : v) * 2, 0);
    const [cols, rows] = gridFor(n0);
    const L = layout(cols, rows, n0);
    const deck = buildDeck(def, pairs0);
    const cards = makeCards(deck, L, false);
    const bonus = (app.save.bonusWater || 0) + M.water;
    if (M.gaze && !keepTries) app.save.gifts.gaze += M.gaze; // Взор — только на первую попытку, чтобы не копить смертями
    const flash0 = def.flash || (M.storm > 0 ? 9 : 0); // гроза из знамения на поле без грозы (замедление её не создаёт)
    return {
      id, def, son: def.son != null ? SONS[def.son] : null, L, cards, cols, layer: 0, nLayers: def.layers.length, pidNext: deck.length / 2,
      cam: { s: 1.06, y: 0.5, ts: 1.06, ty: 0.5 }, up, mods: M, shards: 0, coach: def.tutorial ? { step: 0, t: 0 } : null,
      preview: M.noPreview ? 0 : Math.max(0.6, def.preview + M.preview), flashEvery: flash0 ? Math.max(3, flash0 - M.storm - M.stormUp) : 0, storm: 0,
      deimosEvery: def.deimos || M.quake, freeMiss: M.freeMiss, windT: 0,
      phase: 'intro', pt: 0, time: 0,
      water: Math.max(1, def.water[0] + bonus), maxWater: Math.max(2, def.water[1] + bonus + M.cap), previewFrac: M.previewFrac, previewSet: M.previewFrac < 1 ? pickSet(cards.length, M.previewFrac) : null, flaskTaken: false, horn: false,
      attempts: 0, misses: 0, streak: 0, favor: 0, giftsUsed: 0, decoyTaken: 0, bitten: 0, ravenSwaps: 0,
      ritual: { helm: false, shield: false, spears: 0, spearsNeed: totalPairs(def, 'spears'), coin: false, bolt: false },
      sel: [], resolveT: -1, viewT: M.fastClose ? 0.45 : 1.0 + M.linger,
      ravens: false, hound: false, deimos: false, phobos: false,
      deimosCount: 0, flashT: 0, flashA: 0, bolts: [], shake: 0,
      dialog: null, dq: [], lineCd: 0, ambCd: rand(14, 24), tele: [], tip: null,
      gazeMode: false, hintUsed: false, rememberT: 0, tries: (keepTries || 0),
      pyre: null, lament: null, paused: false, result: null, soundCd: 0,
      altar: { x: 820, y: 168, s: 1 }, alive: false, waterW: 230,
    };
  }

  function say(textStr, who = 'father', prio = 1, name) {
    if (!textStr) return;
    // фоновые реплики (prio ≤ 1) не встают в очередь и не перебивают свежую реплику — окно не спамит
    if (prio <= 1 && S.dialog && S.dialog.t < 2.5 && !S.dialog.fade) return;
    if (S.dialog && S.dialog.t < 1.4 && S.dialog.prio > prio) { if (S.dq.length < 3) S.dq.push({ text: textStr, who, prio, name }); return; }
    S.dialog = { text: textStr, who, t: 0, prio, name };
  }
  const rl = v => Array.isArray(v) ? pick(v) : v;
  // мешок реплик: варианты по кругу в случайном порядке, без повтора подряд (и между полями — мешки живут в сцене)
  const bags = {}, lastLine = {}, lastAt = {}; let clock = 0;
  function line(key, n) {
    const v = LINES[key]; if (!Array.isArray(v)) return v;
    let b = bags[key];
    if (!b || !b.length) { b = bags[key] = shuffle([...v]); if (b.length > 1 && b[b.length - 1] === lastLine[key]) b.unshift(b.pop()); }
    const s = b.pop(); lastLine[key] = s;
    return n != null ? s.replace(/\{n\}/g, n) : s;
  }
  // реплика события с паузой LINE_CD: событие, сказанное недавно, молчит
  function sayL(key, prio = 1, n) {
    const cd = LINE_CD[key] || 0;
    if (cd && lastAt[key] != null && clock - lastAt[key] < cd) return;
    lastAt[key] = clock; say(line(key, n), 'father', prio);
  }

  // ---------------------------------------------------------------- логика
  function clickCard(c) {
    if (S.phase !== 'play' || S.paused || c.matched || c.gone || c.fly) return false;
    if (S.gazeMode) { // Взор Афины: подсмотреть одну карту без траты глотка
      if (c.open) return false;
      S.gazeMode = false; c.peek = 1.6 + S.mods.gazeLen; c.seen = true; c.vis = true;
      if (S.mods.gazeWide) { const s0 = S.L.slots[c.slot]; for (const o of S.cards) { const s = S.L.slots[o.slot]; if (!o.matched && !o.gone && s.r === s0.r && Math.abs(s.c - s0.c) <= 1) { o.peek = 0.5; o.seen = true; o.vis = true; } } } sfx('owl', { vol: 0.35 }); S.giftsUsed++; app.save.gifts.gaze--; app.persist(); coachEvent('gazeUsed'); return true;
    }
    if (coachBlocks()) return false;
    if (c.pinT > 0) { c.shake = 0.2; return false; } // карту держит ворон/пёс: сначала перестановка
    if (c.open || S.sel.length >= 2 || S.resolveT > 0 || S.water <= 0) return false;
    c.prevVis = c.vis; c.vis = true;   // «строгая память»: карта, которую уже открывали
    c.open = true; c.seen = true; S.sel.push(c); sfx('flip', { vol: 0.7 }); coachEvent('flip');
    if (c.type === 'raven' && S.ravens) setTimeout0(() => ravenSwap(c), 0.35);
    if (c.type === 'horn' && S.horn) setTimeout0(() => hornAlarm(c), 0.35);
    if (S.sel.length === 2) { S.attempts++; S.resolveT = 0.42; }
    return true;
  }
  const timers = [];
  function setTimeout0(fn, t) { timers.push({ fn, t }); }

  function resolve() {
    const [a, b] = S.sel; S.resolveT = -1;
    const match = a.key === b.key; // по облику, а не по номеру пары: два «копья» из разных пар — тоже пара
    if (match) {
      const verdict = ritualCheck(a);
      if (verdict) { // пара настоящая, но рано
        a.reject = b.reject = 1; say(verdict, 'father', 3); sfx('harp_bad', { vol: 0.5 });
        setTimeout0(() => closeSel(), 1.25); S.streak = 0;
        return;
      }
      accept(a, b);
    } else {
      S.misses++; S.streak = 0; sfx('miss', { vol: 0.6 });
      a.shake = b.shake = 0.35;
      const M = S.mods, graced = M.grace && S.misses % M.grace === 0, cost = (M.dear && S.misses % M.dear === 0 ? 2 : 1) + (M.strict && (a.prevVis || b.prevVis) ? 1 : 0);
      if (S.freeMiss > 0) { S.freeMiss--; floater((a.x + b.x) / 2, Math.min(a.y, b.y) - 20, '0', '#cfc0ff'); } // «Память отца»: первые промахи бесплатны
      else if (graced) { floater((a.x + b.x) / 2, Math.min(a.y, b.y) - 20, '0', '#a8e08e'); toast('Милость Деметры: промах прощён'); } // ступень «Милость» / реликвия: каждый N-й промах прощается
      else { S.water = Math.max(0, S.water - cost); floater((a.x + b.x) / 2, Math.min(a.y, b.y) - 20, '−' + cost, cost > 1 ? '#ff9a7a' : '#9fd0ff'); }
      // знамение «Перетасовка»: каждый N-й промах две закрытые карты меняются местами (видно полёт)
      if (S.mods.shuffle && S.misses % S.mods.shuffle === 0) setTimeout0(() => { const pool = S.cards.filter(c => !c.open && !c.matched && !c.gone && !c.fly); if (pool.length >= 2 && S.phase === 'play') { const x = pick(pool), y = pick(pool.filter(c => c !== x)); swapSlots(x, y, 0.8); sfx('wind', { vol: 0.3 }); say('Ветер перевернул тела — две вещи поменялись местами.', 'father', 2); } }, 0.9);
      if (S.water === 2) say(line('low1'), 'father', 2); else if (S.water === 1) say(line('low2'), 'father', 2);
      coachEvent('miss');
      // пёс Ареса кусает, если ему не нашли пару сразу
      const hound = [a, b].find(c => c.type === 'hound');
      if (hound && S.hound) {
        S.water = Math.max(0, S.water - 1); S.bitten++; S.shake = 0.5; sfx('snarl', { vol: 0.8 }); sayL('hound', 3); floater(hound.x, hound.y, '−1', '#ff6b5a');
        // пёс отскакивает на другое место — ещё одна перестановка; цель видна заранее (кольца + стрелка), потом прыжок
        const pool = S.cards.filter(c => c !== hound && !c.open && !c.matched && !c.gone && !c.fly && !(c.pinT > 0));
        if (pool.length) {
          const tgt = pick(pool); telegraph('hound', hound, tgt);
          setTimeout0(() => { if (S.hound && S.phase === 'play' && !tgt.matched && !tgt.gone && !tgt.fly && !tgt.open && !hound.matched && !hound.gone) { swapSlots(hound, tgt, 0.6); sfx('growl', { vol: 0.4 }); } }, TELE);
        }
      }
      else if (Math.random() < 0.25) sayL('miss', 0);
      const view = S.phobos ? 0.42 : S.viewT;
      setTimeout0(() => closeSel(), view);
    }
    afterAttempt();
    if (match) coachEvent('match');
  }
  function closeSel() { for (const c of S.sel) { c.open = false; c.reject = 0; } S.sel = []; checkDeath(); }

  function ritualCheck(c) {
    const R = S.ritual;
    if (c.type === 'coin' && !R.helm) return line('coinEarly');
    if (c.type === 'bolt') {
      if (!R.helm) return line('boltNoBody');
      if (!R.coin) return line('boltNoCoin');
      if (!R.shield || R.spears < R.spearsNeed) return line('boltNoBed');
    }
    return null;
  }

  function accept(a, b) {
    S.streak++; S.favor++; S.shards += 1;
    for (const c of [a, b]) { c.matched = true; c.glow = 1; }
    S.sel = [];
    const t = a.type, R = S.ritual;
    const toAltar = () => { for (const c of [a, b]) flyTo(c, S.altar.x, S.altar.y + 10, 0.55); };
    const vanish = (col = '#e8d9c8') => { for (const c of [a, b]) { c.fade = 1; parts.burst(c.x, c.y, 10, { color: [col, '#fff'], speed: [30, 140], life: [0.4, 0.9], size: [1, 3], g: -40 }); } };
    sfx('harp_ok', { vol: 0.45 });
    switch (t) {
      case 'helm': R.helm = true; toAltar(); sfx('bones', { vol: 0.5 }); say(S.son ? tr(line('helmSon', S.son.name)) + ' ' + tr(line('helm')) : line('helm'), 'father', 3); if (S.son?.mem) S.dq.push({ text: S.son.mem, who: 'father', prio: 3 }); if (S.decoyTaken === 0 && S.def.recognize) app.ach('recognize'); break;
      case 'shield': R.shield = true; toAltar(); sfx('draw', { vol: 0.4 }); say(line('shield'), 'father', 2); break;
      case 'spears': R.spears++; toAltar(); sfx('slash', { vol: 0.35 }); sayL('spears', 2); break;
      case 'coin': R.coin = true; toAltar(); sfx('coin', { vol: 0.8 }); say(line('coin'), 'father', 3); break;
      case 'bolt': R.bolt = true; toAltar(); sfx('thunder2', { vol: 0.6 }); say(line('bolt'), 'father', 4); startPyre(); break;
      case 'flask': case 'amphora': {
        const add = Math.max(1, (t === 'flask' ? S.def.fl : (S.def.am || 4)) + S.mods.flask + (t === 'flask' && !S.flaskTaken && S.water <= 2 ? S.mods.flaskFirst : 0)); if (t === 'flask' && S.water <= 2) S.flaskTaken = true;   // ступень «Глубокие фляги»: первая фляга у пересохшего горла лучше
        coachEvent('water');
        S.water = Math.min(S.maxWater, S.water + add); sfx('drink', { vol: 0.8 });
        for (const c of [a, b]) flyTo(c, 120, 30, 0.6, true);
        if (t === 'amphora') say(line('amphora'), 'father', 2); else sayL('water', 2); floater(a.x, a.y, '+' + add, '#9fd0ff');
        if (S.def.goal === 'water' && S.water >= S.maxWater - 1) { /* обучение: силы вернулись */ }
        break;
      }
      case 'skull': vanish(); sayL('skull', 1); break;
      case 'shade': vanish('#6a5a80'); sayL('shade', 1); break;
      case 'foe': vanish(); sayL('foe', 1); S.decoyTaken++; break;
      case 'decoy': vanish('#c8b8a8'); sayL('decoy', 2, S.son?.name || ''); S.decoyTaken++; break;
      case 'raven': vanish('#333'); S.ravens = false; sfx('crow2', { vol: 0.6 }); say(line('ravenPair'), 'father', 2); if (S.ravenSwaps === 0) app.ach('ravens'); break;
      case 'hound': vanish('#552'); S.hound = false; sfx('growl', { vol: 0.5, rate: 1.3 }); say(line('houndPair'), 'father', 2); if (S.bitten === 0) app.ach('hound'); break;
      case 'laurel': vanish('#8fcf7a'); S.shards += 3; floater(a.x, a.y, '+3 ✦', '#ffe08a'); sfx('coin', { vol: 0.5 }); sayL('laurel', 1); break;
      case 'horn': vanish('#d8b060'); S.horn = false; sfx('air', { vol: 0.5 }); say(line('hornPair'), 'father', 2); break;
      case 'owl': vanish('#fff'); app.save.gifts.gaze++; app.persist(); sayL('owl', 2); sfx('owl', { vol: 0.5 }); break;
      case 'phobos': vanish('#a33'); S.phobos = false; sfx('monster', { vol: 0.5, rate: 1.4 }); say(line('phobosPair'), 'father', 3); break;
      case 'deimos': vanish('#a63'); S.deimos = false; sfx('dread', { vol: 0.4, rate: 1.3 }); say(line('deimosPair'), 'father', 3); break;
      case 'living': vanish('#cfe3ff'); S.alive = true; sfx('groan', { vol: 0.6 }); app.ach('alive'); setTimeout0(() => app.inlineStory('alive', () => { app.save.licymnius = true; app.persist(); }), 1.0); break;
      case 'name': case 'sshield': {
        const son = SONS[a.son]; for (const c of [a, b]) { c.fade = 1; parts.burst(c.x, c.y, 16, { color: ['#fff6e0', '#ffd9a0'], speed: [20, 120], life: [0.6, 1.2], size: [1, 3], g: -80, glow: true }); }
        S.souls = S.souls || []; S.souls.push({ x: a.x, y: a.y, t: 0, son: a.son }); sfx('sacred', { vol: 0.35 }); say(`${son.name}. Плыви с миром.`, 'charon', 2); break;
      }
    }
    // тень «Кровь предков»: вещь обряда даёт глоток
    if (S.mods.ritualWater && ['helm', 'shield', 'spears', 'coin'].includes(t)) { S.water = Math.min(S.maxWater, S.water + 1); floater(b.x, b.y, '+1', '#ff9a8a'); }
    // тень «Сухое горло»: серия из трёх точных пар — глоток
    if (S.mods.streakWater && S.streak > 0 && S.streak % 3 === 0) { S.water = Math.min(S.maxWater, S.water + 1); floater(b.x, b.y - 20, '+1', '#9fd0ff'); }
    // серия точных пар — благосклонность богов
    if (S.streak > 0 && S.streak % 3 === 0 && t !== 'bolt') {
      const g = pick(['gaze', 'flash', 'amph']); app.save.gifts[g]++; app.persist();
      toast('Благосклонность богов: ' + GIFTS.find(x => x.id === g).name); sfx('bells', { vol: 0.3 }); sayL('streak', 0);
      if (!app.save.tipGifts) { app.save.tipGifts = 1; app.persist(); toast('Дары — вверху справа. Нажми, чтобы призвать.'); }
    }
    // обучение дарам: слоёв больше нет — после третьей пары, пока поле не разобрано
    if (S.def.tutorial && S.cards.filter(c => c.matched).length >= 6 && !S.cards.every(c => c.matched)) coachEvent('gifts');
    if (S.def.teachRitual && ['shield', 'spears', 'helm'].includes(t) && !S.ritualTaught) { S.ritualTaught = true; S.coach = { step: 'ritual', t: 0 }; }
    // слой разобран: шаг вперёд или конец поля (обучение и имена)
    if (S.cards.every(c => c.matched) && t !== 'bolt') {
      if (S.layer < S.nLayers - 1) setTimeout0(() => advanceLayer(), 1.0);
      else if (S.def.goal) setTimeout0(() => finishSimple(), 1.2);
    }
  }

  function afterAttempt() {
    if (S.deimos && S.deimosEvery && S.attempts % S.deimosEvery === 0) setTimeout0(() => deimosShift(), 1.3);
    // гроза копится за каждый ход; полная — игрок сам решает, когда осветить поле
    if (S.flashEvery && S.storm < S.flashEvery) {
      S.storm++;
      // тень «Гнев Зевса»: молния бьёт сама и коротко, как только туча полна
      if (S.storm === S.flashEvery && S.mods.stormAuto) setTimeout0(() => { if (S.phase === 'play' && stormReady()) { S.storm = 0; lightningFlash(0.45); S.flashA = 1; sfx('bolt', { vol: 0.5 }); } }, 1.4);
      else if (S.storm === S.flashEvery) { sfx('thunder', { vol: 0.25, rate: 0.7 }); if (!app.save.tipStorm) { app.save.tipStorm = 1; app.persist(); toast('Гроза набралась! Нажми на тучу — молния осветит всё поле.'); } }
    }
  }
  function checkDeath() {
    if (S.phase === 'play' && S.water <= 0 && !S.ritual.bolt && !S.cards.every(c => c.matched)) {
      S.phase = 'dead'; S.pt = 0; sfx('chord', { vol: 0.7 }); app.save.stats.deaths++; noteFail(app.save, S.id);
      S.shards = Math.round(S.shards * S.mods.shardMul); // множитель тени алтаря и знамения
      app.save.shards = (app.save.shards || 0) + S.shards; app.persist();
      if (app.save.stats.deaths >= 3) app.ach('deaths'); setDrone(0.8);
      setTimeout0(() => { setDrone(0); app.death({ id: S.id, shards: S.shards, tries: S.tries + 1, son: S.son, layer: S.layer, nLayers: S.nLayers }); }, 1.6);
    }
  }

  // ворон: сначала садится над двумя вещами (кольца, стрелка ↔, карты дрожат), через TELE меняет их местами
  function ravenSwap(raven) {
    if (!S.ravens || S.phase !== 'play') return;
    const pool = S.cards.filter(c => !c.open && !c.matched && !c.gone && c !== raven && c.type !== 'raven' && c.type !== 'horn' && !c.fly && !(c.pinT > 0));
    const seen = pool.filter(c => c.seen);
    if (pool.length < 2) return;
    const a = (seen.length ? pick(seen) : pick(pool)); const rest = pool.filter(c => c !== a); const b = pick(rest);
    telegraph('raven', a, b);
    S.birds = S.birds || []; S.birds.push({ x0: raven.x, y0: raven.y, a, b, t: 0, wait: TELE });
    sfx('crow', { vol: 0.6 }); sayL('ravenSwap', 2);
    // вороны разогнаны или вещь уже взяли — ничего не двигаем
    setTimeout0(() => { if (!S.ravens || S.phase !== 'play' || [a, b].some(c => c.open || c.matched || c.gone || c.fly)) return; swapSlots(a, b, 0.75); S.ravenSwaps++; sfx('crow2', { vol: 0.35, rate: 1.2 }); }, TELE);
  }
  // горн тафийцев: открыли — как у ворона знак (кольца и стрелка), через TELE две закрытые карты меняются местами
  function hornAlarm(horn) {
    if (!S.horn || S.phase !== 'play') return;
    const pool = S.cards.filter(c => !c.open && !c.matched && !c.gone && c !== horn && c.type !== 'raven' && c.type !== 'horn' && !c.fly && !(c.pinT > 0));
    if (pool.length < 2) return;
    const seen = pool.filter(c => c.seen), a = seen.length ? pick(seen) : pick(pool), b = pick(pool.filter(c => c !== a));
    telegraph('horn', a, b); sfx('wind', { vol: 0.5, rate: 0.6 }); sayL('horn', 2);
    setTimeout0(() => { if (!S.horn || S.phase !== 'play' || [a, b].some(c => c.open || c.matched || c.gone || c.fly)) return; swapSlots(a, b, 0.75); S.ravenSwaps++; sfx('crow2', { vol: 0.3, rate: 0.8 }); }, TELE);
  }
  function telegraph(kind, a, b) {
    for (const c of [a, b]) { c.warn = TELE; c.pinT = TELE + 0.05; }
    S.tele.push({ kind, a, b, t: 0, dur: TELE });
  }
  function swapSlots(a, b, dur) {
    const sa = a.slot; a.slot = b.slot; b.slot = sa;
    for (const c of [a, b]) { const s = S.L.slots[c.slot]; c.move = { x0: c.x, y0: c.y, x1: s.x, y1: s.y, t: 0, dur }; }
  }
  // Деймос: ряд светится и дрожит, стрелки показывают сдвиг вправо (крайняя — в начало); через TELE ряд едет
  function deimosShift() {
    if (!S.deimos || S.phase !== 'play') return;
    const rows = [...new Set(S.cards.filter(c => !c.gone && !c.matched).map(c => S.L.slots[c.slot].r))];
    if (!rows.length) return;
    const r = pick(rows);
    for (const c of S.cards) if (!c.gone && S.L.slots[c.slot].r === r) c.warn = TELE;
    S.tele.push({ kind: 'deimos', r, t: 0, dur: TELE });
    sfx('dread', { vol: 0.25, rate: 0.8 }); sayL('deimosShift', 2);
    setTimeout0(() => deimosMove(r), TELE);
  }
  function deimosMove(r) {
    if (!S.deimos || S.phase !== 'play') return; // Деймоса изгнали за время знака — ряд стоит
    const cols = Math.min(S.cols, S.L.n - r * S.cols);
    const inRow = S.cards.filter(c => S.L.slots[c.slot].r === r);
    for (const c of inRow) { const s = S.L.slots[c.slot]; const nc = (s.c + 1) % cols; c.slot = r * S.cols + nc; const ns = S.L.slots[c.slot]; c.move = { x0: c.x, y0: c.y, x1: ns.x, y1: ns.y, t: 0, dur: 0.6, arc: s.c === cols - 1 }; }
    S.shake = 0.35; sfx('dread', { vol: 0.35 }); sfx('bones', { vol: 0.3, rate: 0.7 });
    S.rowFlash = { r, t: 0 };
  }
  function lightningFlash(dur) {
    S.flashT = dur; S.flashA = 1; S.bolts.push({ b: boltPath(rand(80, 880), -10, rand(100, 860), rand(140, 260), 30), t: 0 });
    sfx(pick(['thunder', 'thunder2']), { vol: 0.5 });
  }
  function flyTo(c, x, y, dur, water) { c.fly = { x0: c.x, y0: c.y, x1: x, y1: y, t: 0, dur, water }; }
  function floater(x, y, s, color) { (S.floaters ||= []).push({ x, y, s, color, t: 0 }); }
  function toast(s) { (S.toasts ||= []).push({ s, t: 0 }); }

  // ---- костёр
  function startPyre() {
    S.phase = 'pyreWait'; S.pt = 0;
    for (const c of S.cards) if (!c.matched) c.fade = 1;
  }
  function beginFire() {
    S.phase = 'pyre'; S.pt = 0; S.pyre = { t: 0, struck: false, soul: null, star: false }; setMood('pyre');
    musicDuck(0.5);
  }
  function finishSimple() {
    if (S.phase !== 'play') return;
    S.phase = 'result'; S.pt = 0; S.result = scoreResult(); sfx('sacred', { vol: 0.4 });
  }
  function scoreResult() {
    const pairs = S.cards.length / 2;
    const m = S.misses;
    const stars = m <= Math.ceil(pairs * 0.35) ? 3 : m <= Math.ceil(pairs * 0.9) ? 2 : 1;
    const prev = app.save.best[S.id] || 0; if (stars > prev) app.save.best[S.id] = stars;
    if (m === 0) app.ach('perfect');
    if (S.time < 75 && pairs >= 6) app.ach('fast');
    if (S.water === 1 && S.ritual.bolt) app.ach('thirst');
    if (S.id === 'names' && m === 0) app.ach('names');
    S.shards = Math.round((S.shards + stars * 2 + Math.min(S.mods.waterShards, S.water)) * S.mods.shardMul);   // «Широкая амфора»: остаток воды — осколки
    app.save.shards = (app.save.shards || 0) + S.shards;
    if (app.save.omen?.field === S.id) app.save.omen = null; // знамение снято победой
    clearFail(app.save, S.id);   // упрямство отца кончается победой
    app.fieldDone(S);
    app.persist();
    return { stars, misses: m, attempts: S.attempts, time: S.time, water: S.water, shards: S.shards };
  }

  // ---- «Плач»: повторить мелодию лиры (последовательная память)
  function startLament() {
    const n = S.def.lament;
    S.phase = 'lament'; S.pt = 0;
    const seq = []; for (let i = 0; i < n; i++) { let v; do v = Math.floor(rand(5)); while (v === seq[i - 1] || (i > 1 && v === seq[i - 2] && seq[i - 1] === seq[i - 3])); seq.push(v); }
    S.lament = { seq, i: 0, show: true, showT: 0, input: [], tries: 0, flash: [-1, 0], errors: 0 };
    say('Спой ему плач. Повтори напев лиры.', 'father', 5);
  }

  // ---- слои поля: шаг вперёд к вратам
  function layerThreats() {
    const live = S.cards; S.ravens = live.some(c => c.type === 'raven'); S.hound = live.some(c => c.type === 'hound');
    S.deimos = live.some(c => c.type === 'deimos'); S.phobos = live.some(c => c.type === 'phobos'); S.horn = live.some(c => c.type === 'horn');
  }
  function advanceLayer() {
    if (S.phase !== 'play') return;
    S.phase = 'advance'; S.pt = 0; S.shards += 3;
    sfx('steps', { vol: 0.6 }); sfx('wind', { vol: 0.3 });
    S.cam.ts = 1.06 + 0.12 * (S.layer + 1); S.cam.ty = 0.5 + 0.035 * (S.layer + 1);
    say(S.layer === S.nLayers - 2 ? 'Ещё шаг… Там, у врат, лежит он.' : pick(['Дальше. Шаг за шагом.', 'Ещё ряд тел. Вперёд.', 'Отец идёт дальше.']), 'father', 2);
  }
  function updateAdvance(dt) {
    if (S.pt > 1.4 && !S.dealt) {
      S.dealt = true; S.layer++;
      const pairs = S.def.layers[S.layer];
      const n = Object.entries(pairs).reduce((a, [k, v]) => a + (k === 'assoc' ? v.length : v) * 2, 0);
      const [cols, rows] = gridFor(n); S.cols = cols; S.L = layout(cols, rows, n);
      const deck = buildDeck(S.def, pairs, S.pidNext); S.pidNext += deck.length / 2;
      S.cards = makeCards(deck, S.L, true); sfx('flip', { vol: 0.6, rate: 0.7 });
      layerThreats(); coachEvent('layer');
    }
    if (S.pt > 2.3) { S.dealt = false; S.phase = S.preview ? 'preview' : 'play'; S.pt = 0; if (S.preview) lightningFlash(0.05); }
  }

  // ---- тренер обучения: подсказка с рамкой вокруг цели; блокирующие шаги ждут действия
  const GIFT_RECT = i => ({ x: 728 + i * 56, y: 8, w: 48, h: 50 });
  const COACH = {
    0: { text: 'Среди тел — вещи павших. Коснись любой карты, чтобы перевернуть её.', rect: () => BOARD },
    1: { text: 'Теперь вторую. Если обе одинаковые — пара твоя.', rect: () => BOARD },
    missInfo: { text: 'Промах стоит одного глотка. Глотки — слева вверху. Кончатся — придёт Харон.', rect: () => ({ x: 6, y: 4, w: S.waterW + 4, h: 56 }), auto: 5 },
    matchInfo: { text: 'Пара найдена — это бесплатно. Платишь только за промахи.', rect: () => BOARD, auto: 4 },
    waterInfo: { text: 'Фляги возвращают глотки. Ищи их, когда горло пересохнет.', rect: () => ({ x: 6, y: 4, w: S.waterW + 4, h: 56 }), auto: 4 },
    gaze: { text: 'Боги помогают отцу. Нажми на сову — это «Взор Афины».', rect: () => GIFT_RECT(0), block: true },
    gazePick: { text: 'Коснись любой закрытой карты — она откроется бесплатно.', rect: () => BOARD, block: false, gazeOnly: true },
    flash: { text: 'А это «Вспышка Зевса»: на миг освещает всё поле. Нажми.', rect: () => GIFT_RECT(1), block: true },
    giftsDone: { text: 'Дары даются за серии точных пар и за ночи-воспоминания. Не жалей их.', rect: () => ({ x: 720, y: 4, w: 180, h: 58 }), auto: 5 },
    ritual: { text: 'Для костра нужны шлем сына, щит, копья, обол и молния. Обол и молния — только в конце. Увидел раньше — запомни где.', rect: () => ({ x: 694, y: 258, w: 254, h: 84 }), auto: 7, place: 'left' },
  };
  function coachEvent(ev) {
    if (!S.def.tutorial && !S.def.teachRitual) return;
    const C = S.coach || {};
    if (C.step === 0 && ev === 'flip') next(1);
    else if (C.step === 1 && (ev === 'miss' || ev === 'match')) next(ev === 'miss' ? 'missInfo' : 'matchInfo');
    else if (ev === 'water' && !S.waterTaught) { S.waterTaught = true; next('waterInfo'); }
    else if (ev === 'gifts' && S.def.tutorial && !S.giftsTaught) { S.giftsTaught = true; app.save.gifts.gaze = Math.max(1, app.save.gifts.gaze); app.save.gifts.flash = Math.max(1, app.save.gifts.flash); next('gaze'); }
    else if (C.step === 'gaze' && ev === 'gazeMode') next('gazePick');
    else if (C.step === 'gazePick' && ev === 'gazeUsed') next('flash');
    else if (C.step === 'flash' && ev === 'flashUsed') next('giftsDone');
    function next(st) { S.coach = { step: st, t: 0 }; }
  }
  function coachBlocks() { const C = S.coach && COACH[S.coach.step]; return !!(C && C.block); }
  function drawCoach(ctx) {
    const C = S.coach && COACH[S.coach.step]; if (!C || !['play', 'preview'].includes(S.phase)) return;
    const r = C.rect(), a = Math.min(1, S.coach.t * 3);
    ctx.save(); ctx.globalAlpha = a;
    if (C.block) { ctx.fillStyle = 'rgba(4,2,3,0.55)'; ctx.fillRect(0, 0, W, r.y); ctx.fillRect(0, r.y + r.h, W, H - r.y - r.h); ctx.fillRect(0, r.y, r.x, r.h); ctx.fillRect(r.x + r.w, r.y, W - r.x - r.w, r.h); }
    const pulse = 0.6 + 0.4 * Math.sin(S.time * 6);
    ctx.strokeStyle = `rgba(255,214,150,${pulse})`; ctx.lineWidth = 3; ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
    const bw = 380, lines = wrap(ctx, C.text, bw - 30, 17), bh = 24 + lines.length * 21;
    let bx = clamp(r.x + r.w / 2 - bw / 2, 10, W - bw - 10), by = r.y + r.h + 14; if (by + bh > H - 8) by = Math.max(70, r.y - bh - 14);
    if (r === BOARD || r.h > 300) { bx = BOARD.x + BOARD.w / 2 - bw / 2; by = BOARD.y + BOARD.h - bh - 6; }
    if (C.place === 'left') { bx = r.x - bw - 16; by = r.y + r.h / 2 - bh / 2; }
    comicBox(ctx, bx, by, bw, bh, 0.96);
    lines.forEach((l, i) => text(ctx, l, bx + bw / 2, by + 22 + i * 21, { size: 17, color: '#ffe6c0' }));
    ctx.restore();
  }

  // ---------------------------------------------------------------- сцена
  const scene = {
    get S() { return S; },
    enter(game, opts = {}) {
      S = newState(opts.id || 'f1', opts.tries);
      rain.amount = S.def.rain || 0; fog.amount = S.def.fog || 0;
      playMusic(null); setMood(S.def.mood || 'field'); layerThreats();
      setAmbient({ rain: (S.def.rain || 0) * 0.55, night: S.def.rain ? 0.12 : 0.35, wind: S.def.fog ? 0.25 : 0.05, fire: 0, howls: 0 });
      setDrone(S.def.id === 'f8' ? 0.3 : 0);
      musicDuck(1);
      timers.length = 0;
    },
    clickCard: i => clickCard(S.cards[i]),
    useStorm: () => useStorm(), stormReady: () => !!stormReady(), // для бота-плейтеста
    update(dt, rdt) {
      if (!S) return;
      const inp = app.inp;
      if (inp.hit('Escape') && ['play', 'preview', 'intro'].includes(S.phase)) S.paused = !S.paused;
      if (S.paused) { inp.endStep(); return; }
      S.pt += dt; clock += dt; rain.update(dt);
      for (const T of S.tele) T.t += dt; S.tele = S.tele.filter(T => T.t < T.dur);
      if (S.tip) { S.tip.t += dt; const P = inp.pointer, r = S.tip.r; if (P.pressed && S.tip.t > 0.1 && !(P.x > r.x && P.x < r.x + r.w && P.y > r.y && P.y < r.y + r.h)) S.tip = null; } fog.update(dt); parts.update(dt, 600);
      if (S.dialog) { S.dialog.t += dt; if (S.dialog.t > 6 + S.dialog.text.length / 30) { S.dialog.fade = Math.max(0, 1 - (S.dialog.t - 6 - S.dialog.text.length / 30)); if (S.dialog.fade <= 0) S.dialog = null; } }
      if (S.dq.length && (!S.dialog || S.dialog.t > 1.6)) { const q = S.dq.shift(); S.dialog = { ...q, t: 0 }; }
      for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
      S.flashT = Math.max(0, S.flashT - dt); S.flashA = Math.max(0, S.flashA - dt * 2.2); S.shake = Math.max(0, S.shake - dt);
      for (const b of S.bolts) b.t += dt; S.bolts = S.bolts.filter(b => b.t < 0.35);
      if (S.rowFlash) { S.rowFlash.t += dt; if (S.rowFlash.t > 0.8) S.rowFlash = null; }
      for (const t of S.toasts || []) t.t += dt; if (S.toasts) S.toasts = S.toasts.filter(t => t.t < 3);
      for (const f of S.floaters || []) { f.t += dt; f.y -= 30 * dt; } if (S.floaters) S.floaters = S.floaters.filter(f => f.t < 1.2);
      if (S.coach) { S.coach.t += dt; const C = COACH[S.coach.step]; if (C && C.auto && S.coach.t > C.auto) S.coach = null; }
      S.cam.s += (S.cam.ts - S.cam.s) * Math.min(1, dt * 1.6); S.cam.y += (S.cam.ty - S.cam.y) * Math.min(1, dt * 1.6);
      S.rememberT = Math.max(0, S.rememberT - dt); S.rememberAllT = Math.max(0, (S.rememberAllT || 0) - dt);

      // карты
      for (const c of S.cards) {
        const target = (c.open || c.peek > 0 || S.flashT > 0 || (S.phase === 'preview' && (!S.previewSet || S.previewSet.has(c.i))) || (S.rememberAll > 0)) ? 1 : 0;
        c.face += clamp(target - c.face, -dt * 5, dt * 5);
        c.warn = Math.max(0, (c.warn || 0) - dt); c.pinT = Math.max(0, (c.pinT || 0) - dt);
        c.peek = Math.max(0, c.peek - dt); c.shake = Math.max(0, c.shake - dt); c.glow = Math.max(0, c.glow - dt * 1.2); c.hint = Math.max(0, c.hint - dt);
        const hov = S.phase === 'play' && hit(c, inp.pointer.x, inp.pointer.y) && !c.matched;
        c.lift += ((c.open || hov ? 1 : 0) - c.lift) * Math.min(1, dt * 12);
        if (c.move) { const m = c.move; m.t += dt; const k = ease.inOutSine(Math.min(1, m.t / m.dur)); c.x = lerp(m.x0, m.x1, k); c.y = lerp(m.y0, m.y1, k) - (m.arc ? Math.sin(k * Math.PI) * 40 : Math.sin(k * Math.PI) * 14); if (m.t >= m.dur) { c.x = m.x1; c.y = m.y1; c.move = null; } }
        if (c.fly) { const f = c.fly; f.t += dt; const k = ease.inCubic(Math.min(1, f.t / f.dur)); c.x = lerp(f.x0, f.x1, k); c.y = lerp(f.y0, f.y1, k) - Math.sin(k * Math.PI) * 60; c.alpha = 1 - k * 0.7; c.flyScale = 1 - k * 0.6; if (f.t >= f.dur) { c.fly = null; c.gone = true; parts.burst(c.x, c.y, 14, { color: f.water ? ['#9fd0ff', '#fff'] : ['#ffcf8a', '#fff', '#ff7a3a'], speed: [40, 160], life: [0.3, 0.8], size: [1, 3], glow: true }); } }
        if (c.fade) { c.fade = Math.max(0, c.fade - dt * 1.5); c.alpha = c.fade; if (c.fade <= 0) c.gone = true; }
      }

      if (S.phase === 'intro') { if (S.pt > (S.son ? 3.6 : 1.6) || (S.pt > 0.6 && inp.pointer.pressed)) { S.phase = S.preview ? 'preview' : 'play'; S.pt = 0; if (S.preview) { lightningFlash(0.05); } (FIELD_INTRO[S.id] || []).forEach((l, i) => i ? S.dq.push({ text: l, who: 'father', prio: 1 }) : say(l, 'father', 1)); } }
      else if (S.phase === 'preview') { if (S.pt > S.preview) { S.phase = 'play'; S.pt = 0; sfx('flip', { vol: 0.5, rate: 0.8 }); } }
      else if (S.phase === 'play') {
        S.time += dt;
        // знамение «Знойный ветер»: раз в N секунд — минус глоток (пока не открыта пара)
        if (S.mods.wind && S.water > 0) { S.windT += dt; if (S.windT >= S.mods.wind && !S.sel.length) { S.windT = 0; S.water--; floater(120, 70, '−1', '#ffb070'); sfx('wind', { vol: 0.35 }); checkDeath(); } }
        if (S.resolveT > 0) { S.resolveT -= dt; if (S.resolveT <= 0) resolve(); }
        if (inp.pointer.pressed) {
          const c = S.cards.find(c => !c.gone && !c.matched && hit(c, inp.pointer.x, inp.pointer.y));
          if (c) clickCard(c);
        }
        // эмбиент-режиссёр: вороны, сова, вой — с репликами
        S.ambCd -= dt;
        if (S.ambCd <= 0) { S.ambCd = rand(26, 50); const e = pick(S.def.crows ? ['crow', 'owl', 'owl'] : ['owl', 'owl', 'howl']); sfx(e, { vol: 0.4, pan: rand(-0.7, 0.7) }); if (e === 'howl' && Math.random() < 0.5) sayL('howl', 0); if (e === 'crow') S.flyby = { t: 0, y: rand(70, 160), dir: Math.random() < 0.5 ? 1 : -1 }; }
        setDrone(S.water <= 2 ? 0.5 : (S.phobos ? 0.3 : 0));
      }
      else if (S.phase === 'pyreWait') { if (S.pt > 1.0) beginFire(); }
      else if (S.phase === 'advance') updateAdvance(dt);
      else if (S.phase === 'pyre') updatePyre(dt);
      if (S.flyby) { S.flyby.t += dt; if (S.flyby.t > 5) S.flyby = null; }
      for (const b of S.birds || []) b.t += dt; if (S.birds) S.birds = S.birds.filter(b => b.t < (b.wait || 0) + 1.3);
      for (const s of S.souls || []) s.t += dt;
      inp.endStep();
    },
    draw(ctx) { if (S) drawField(ctx); },
    toText() {
      if (!S) return {};
      return { scene: 'field', id: S.id, omen: S.mods.omen?.id || null, wrath: S.mods.wrath, relics: S.mods.relics, pity: S.mods.pity, shardMul: S.mods.shardMul, phase: S.phase, water: S.water, maxWater: S.maxWater, attempts: S.attempts, misses: S.misses, ritual: S.ritual,
        cards: S.cards.map(c => ({ t: c.type, son: c.son, pid: c.pid, k: c.key, open: c.open, m: c.matched, gone: c.gone, x: Math.round(c.x), y: Math.round(c.y) })), result: S.result, paused: S.paused };
    },
  };

  function hit(c, x, y) { const w = S.L.cw, h = S.L.ch; return Math.abs(x - c.x) < w / 2 && Math.abs(y - c.y) < h / 2; }

  function updateLament(dt) {
    const L = S.lament, inp = app.inp;
    L.showT += dt; L.flash[1] = Math.max(0, L.flash[1] - dt);
    if (L.show) {
      const step = 0.7, k = Math.floor((L.showT - 0.8) / step);
      if (k >= 0 && k < L.seq.length && k !== L.lastK) { L.lastK = k; lyre(L.seq[k]); L.flash = [L.seq[k], 0.45]; }
      if (L.showT > 0.8 + L.seq.length * step + 0.3) { L.show = false; L.input = []; }
    } else if (inp.pointer.pressed) {
      const s = lyreString(inp.pointer.x, inp.pointer.y);
      if (s >= 0) {
        lyre(s); L.flash = [s, 0.3]; L.input.push(s);
        const j = L.input.length - 1;
        if (L.input[j] !== L.seq[j]) {
          L.errors++; L.tries++; sfx('harp_bad', { vol: 0.5 });
          if (L.tries >= 3) { say('Голос сорвался… Но он слышал.', 'father', 5); setTimeout0(() => beginFire(), 1.2); L.done = true; }
          else { say('Не так… ещё раз.', 'father', 4); L.show = true; L.showT = 0; L.lastK = -1; }
        } else if (L.input.length === L.seq.length) {
          sfx('harp_ok', { vol: 0.6 }); say('Плач спет.', 'father', 5); if (L.errors === 0) app.ach('lament');
          app.save.gifts.flash++; app.persist(); L.done = true; setTimeout0(() => beginFire(), 1.0);
        }
      }
    }
  }
  const LYRE_X = i => 480 - 2 * 62 + i * 62, LY0 = 172, LY1 = 382;
  const STR_COL = ['#d8574a', '#e0a526', '#9bc06a', '#5aa0d8', '#b07ad8'];
  function lyreString(x, y) { if (y < LY0 - 10 || y > LY1 + 20) return -1; for (let i = 0; i < 5; i++) if (Math.abs(x - LYRE_X(i)) < 29) return i; return -1; }

  function updatePyre(dt) {
    const P = S.pyre; P.t += dt;
    const k = Math.min(1, P.t / 1.2);
    S.altar.x = lerp(820, 480, ease.inOutSine(k)); S.altar.y = lerp(168, 330, ease.inOutSine(k)); S.altar.s = lerp(1, 2.1, ease.inOutSine(k));
    if (!P.struck && P.t > 1.4) {
      P.struck = true; S.flashA = 1; S.shake = 0.7; sfx('bolt', { vol: 0.9 }); sfx('thunder', { vol: 0.7, delay: 0.15 });
      S.bolts.push({ b: boltPath(rand(420, 540), -10, S.altar.x, S.altar.y - 20, 22), t: -0.1 });
      setAmbient({ fire: 0.6, rain: (S.def.rain || 0) * 0.3 }, 1.0);
    }
    if (P.struck && P.t > 1.5) for (let i = 0; i < 3; i++) parts.spawn({ x: S.altar.x + rand(-40, 40), y: S.altar.y - 10, vx: rand(-20, 20), vy: rand(-160, -60), life: rand(0.6, 1.4), size: rand(1, 3), color: pick(['#ffcf6a', '#ff7a2a', '#fff2c0']), glow: true, g: -30 });
    if (P.t > 2.4 && !P.l1) { P.l1 = true; say(line('fire'), 'father', 6); }
    if (P.t > 4.2 && !P.soul) { P.soul = { y: S.altar.y - 60, t: 0 }; sfx('sacred', { vol: 0.5 }); if (S.son) say(S.son.bye, 'son', 7, S.son.name); }
    if (P.soul) { P.soul.t += dt; P.soul.y -= dt * (40 + P.soul.t * 30); }
    if (P.t > 8.2 && !S.result) { S.shards += 8; S.phase = 'result'; S.pt = 0; S.result = scoreResult(); app.save.stats.pyres++; app.ach('first_pyre'); app.persist(); musicDuck(1); setMood(S.def.mood || 'field'); }
  }

  // ---------------------------------------------------------------- отрисовка
  function drawField(ctx) {
    const inp = app.inp, t = S.pt, def = S.def;
    ctx.save();
    if (S.shake > 0 && (app.save.settings.shake ?? 1)) { const a = S.shake * 8; ctx.translate(Math.sin(S.time * 91) * a, Math.cos(S.time * 73) * a); }
    // фон
    const bg = img(def.bg);
    const drift = (S.time + S.pt) * 0.004;
    drawCam(ctx, bg, [0.5 + Math.sin(drift) * 0.03, S.cam.y, S.cam.s]);
    ctx.fillStyle = `rgba(8,4,6,${0.42 - S.flashA * 0.35})`; ctx.fillRect(0, 0, W, H);
    if (S.flashA > 0) { ctx.fillStyle = `rgba(210,200,255,${S.flashA * 0.25})`; ctx.fillRect(0, 0, W, H); }
    for (const b of S.bolts) if (b.t >= 0) drawBolt(ctx, b.b, 1 - b.t / 0.35);
    fog.draw(ctx, 160);
    if (S.flyby) drawFlyby(ctx, S.flyby);

    // доска
    if (!['pyre', 'result', 'lament'].includes(S.phase) || S.cards.some(c => !c.gone && c.alpha > 0.05)) drawBoard(ctx);
    drawAltar(ctx);
    if (STYLE.pixel) pxParticles(ctx, parts); else parts.draw(ctx);
    const fireK = S.pyre && S.pyre.struck ? Math.min(1, (S.pyre.t - 1.4) / 1.2) : (S.ritual.shield || S.ritual.helm ? 0.35 : 0.15);
    gradeScene(ctx, { fire: [S.altar.x, S.altar.y, fireK], moon: S.def.fog ? 0.6 : 1, tint: S.phobos ? '#c9a4a4' : '#cdb3b6' });
    rain.draw(ctx, S.flashA);
    if (S.phobos && S.phase === 'play') { const a = 0.18 + 0.08 * Math.sin(S.time * 2.4); const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.8); g.addColorStop(0, 'rgba(60,0,0,0)'); g.addColorStop(1, `rgba(60,0,0,${a * 2})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    ctx.restore();

    drawHUD(ctx, inp);
    if (S.phase === 'lament') drawLament(ctx);
    if (S.phase === 'pyre') drawPyreOverlay(ctx);
    if (S.rememberT > 0) drawRemember(ctx);
    if (S.rememberAllT > 0) drawRememberAll(ctx);
    if (S.phase === 'result') drawResult(ctx, inp);
    drawPost(ctx, { tint: S.phobos ? '#7a1010' : '#6b3a48', tintA: 0.15 });
    // всё, что надо читать, — поверх виньетки и бумаги drawPost (раньше реплика в колонке тонула в тёмном углу)
    drawWater(ctx); drawStorm(ctx, inp);
    drawTele(ctx);
    for (const b of S.birds || []) drawRaven(ctx, b);
    // правая колонка: обряд, кнопки, реплика
    if (S.phase !== 'pyre' && S.phase !== 'result' && S.phase !== 'lament') drawPanel(ctx);
    for (const f of S.floaters || []) text(ctx, f.s, f.x, f.y - 30, { size: 26, color: f.color, weight: 700, stroke: 3 });
    // реплика: в колонке во время игры, внизу по центру во время костра
    if (['pyre', 'result', 'lament', 'dead'].includes(S.phase)) drawDialog(ctx, S.dialog, 180, 440, 600, 88, { size: 17 });
    else drawDialog(ctx, S.dialog, 690, 404, 258, 124, { size: 16, maxLines: 4, compact: true });
    (S.toasts || []).forEach((o, i) => { const a = Math.min(1, o.t * 4, (3 - o.t) * 2); ctx.globalAlpha = a; comicBox(ctx, W / 2 - 200, 70 + i * 46, 400, 40); text(ctx, o.s, W / 2, 90 + i * 46, { size: 17, color: '#ffe0a8' }); ctx.globalAlpha = 1; });
    drawCoach(ctx);
    drawTip(ctx);
    if (S.phase === 'intro') drawIntro(ctx);
    if (S.phase === 'dead') { ctx.fillStyle = `rgba(4,2,3,${Math.min(1, S.pt / 1.4)})`; ctx.fillRect(0, 0, W, H); drawWater(ctx); } // пустая амфора — поверх затемнения
    if (S.paused) {
      const r = drawPause(ctx, inp, app.save.settings.sfx > 0);
      if (r === 'resume') S.paused = false; else if (r === 'sound') app.toggleSound(); else if (r === 'menu') { S.paused = false; app.goMenu(); }
    }
  }

  function cardImg(c) {
    if (c.type === 'name') return img('card_back');
    if (STYLE.pixel && c.type === 'decoy') return img('card_decoy' + (c.pid % 6)) || img('card_helm');
    return img(CARDS[c.type].img);
  }
  function drawCard(ctx, c, w, h) {
    const face = c.face, sx = Math.abs(Math.cos(face * Math.PI)), front = face > 0.5;
    const lift = c.lift * 6 + (c.glow ? 4 : 0);
    const sc = (c.flyScale ?? 1);
    let x = c.x + (c.shake ? Math.sin(c.shake * 60) * 5 * c.shake / 0.35 : 0) + (c.warn > 0 ? Math.sin(S.time * 55) * 2.2 : 0), y = c.y - lift;
    ctx.save(); ctx.globalAlpha = c.alpha;
    // тень
    ctx.fillStyle = `rgba(0,0,0,${0.35 + c.lift * 0.15})`; if (STYLE.pixel) ctx.fillRect(Math.round((c.x - w * 0.42 * sx * sc) / 4) * 4, Math.round((c.y + h / 2 - 4 + lift * 0.3) / 4) * 4, Math.round(w * 0.84 * sx * sc / 4) * 4, 8); else { ctx.beginPath(); ctx.ellipse(c.x + 3, c.y + h / 2 - 2 + lift * 0.3, w * 0.45 * sx * sc, 6 + lift * 0.6, 0, 0, TAU); ctx.fill(); }
    ctx.translate(x, y); ctx.scale(Math.max(0.02, sx) * sc, sc);
    const im = front ? cardImg(c) : img('card_back');
    if (im) ctx.drawImage(im, -w / 2, -h / 2, w, h);
    if (front) {
      if (c.badge) drawBadge(ctx, c.badge, 0, h * 0.3, w * 0.2);
      // «тень» (знамение «Тени»): лицо как рубашка, только с тёмной дымкой — открытая тень похожа на закрытую карту
      if (c.type === 'shade') { ctx.fillStyle = 'rgba(10,6,14,0.35)'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = 'rgba(200,190,230,0.16)'; ctx.beginPath(); ctx.arc(0, -h * 0.12, w * 0.13, 0, TAU); ctx.ellipse(0, h * 0.16, w * 0.22, h * 0.2, 0, Math.PI, 0); ctx.fill(); }
      if (c.type === 'sshield') drawBadge(ctx, SONS[c.son], 0, 0, w * 0.32);
      if (c.type === 'name') { ctx.fillStyle = 'rgba(15,10,12,0.78)'; ctx.fillRect(-w * 0.42, -h * 0.1, w * 0.84, h * 0.2); text(ctx, SONS[c.son].name, 0, 1, { size: Math.max(11, w * 0.17), color: '#f4e4cc', sc: true }); }
      if (c.reject) { ctx.strokeStyle = 'rgba(255,90,70,0.9)'; ctx.lineWidth = 3; ctx.strokeRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6); drawLock(ctx, 0, -h * 0.36, w * 0.13); }
      if (S.flashT > 0 && !c.open) { ctx.fillStyle = 'rgba(200,190,255,0.18)'; ctx.fillRect(-w / 2, -h / 2, w, h); }
    }
    if (c.glow > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,210,150,${c.glow * 0.35})`; ctx.fillRect(-w / 2, -h / 2, w, h); }
    if (c.hint > 0) { ctx.strokeStyle = `rgba(150,210,255,${0.5 + 0.5 * Math.sin(S.time * 10)})`; ctx.lineWidth = 3; ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6); }
    ctx.restore();
  }
  function drawLock(ctx, x, y, r) { if (STYLE.pixel) return pxIcon(ctx, 'lock', x, y, 4); ctx.save(); ctx.fillStyle = '#ff6a50'; ctx.fillRect(x - r, y - r * 0.2, r * 2, r * 1.6); ctx.strokeStyle = '#ff6a50'; ctx.lineWidth = r * 0.4; ctx.beginPath(); ctx.arc(x, y - r * 0.2, r * 0.7, Math.PI, 0); ctx.stroke(); ctx.restore(); }

  function drawBoard(ctx) {
    const { cw, ch } = S.L;
    if (S.rowFlash) { const s = S.L.slots[S.rowFlash.r * S.cols]; ctx.fillStyle = `rgba(255,120,60,${0.18 * (1 - S.rowFlash.t / 0.8)})`; ctx.fillRect(BOARD.x, s.y - ch / 2 - 6, BOARD.w, ch + 12); }
    // гнёзда пустых мест — «следы» на земле
    for (const s of S.L.slots) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(s.x - cw / 2 + 4, s.y - ch / 2 + 4, cw - 8, ch - 8); }
    const order = S.cards.filter(c => !c.gone).sort((a, b) => (a.lift + (a.move ? 2 : 0) + (a.fly ? 3 : 0)) - (b.lift + (b.move ? 2 : 0) + (b.fly ? 3 : 0)));
    for (const c of order) drawCard(ctx, c, cw, ch);
    if (S.gazeMode) text(ctx, 'Взор Афины: выбери карту', BOARD.x + BOARD.w / 2, BOARD.y - 6, { size: 18, color: '#cfe3ff' });
  }

  function drawPanel(ctx) {
    // заголовок костра
    text(ctx, S.son ? 'Костёр: ' + S.son.name : (S.def.assoc ? 'Харон ждёт' : 'Поле мёртвых'), 819, 80, { size: 17, sc: true, color: '#e9d2b8', spacing: 1 });
    if (S.mods.omen) text(ctx, 'Знамение: ' + S.mods.omen.name, 819, 100, { size: 16, color: '#d6c4f0' });
    // ряд обряда
    if (!S.def.goal) {
      const R = S.ritual, items = [['helm', R.helm], ['shield', R.shield], ['spears', R.spears >= R.spearsNeed], ['coin', R.coin], ['bolt', R.bolt]];
      const x0 = 699, w = 46, h = 62;
      items.forEach(([k, done], i) => {
        const x = x0 + i * (w + 4), y = 264;
        const locked = (k === 'coin' && !R.helm) || (k === 'bolt' && !(R.helm && R.coin && R.shield && R.spears >= R.spearsNeed));
        ctx.save(); ctx.globalAlpha = done ? 1 : 0.55;
        const im = img(CARDS[k].img); if (im) ctx.drawImage(im, x, y, w, h * 0.98);
        if (!done) { ctx.fillStyle = 'rgba(10,6,8,0.55)'; ctx.fillRect(x, y, w, h); }
        ctx.restore();
        if (done) { ctx.strokeStyle = '#ffcf7a'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); text(ctx, '✓', x + w - 9, y + 10, { size: 16, color: '#ffcf7a', weight: 700 }); }
        else if (locked) drawLock(ctx, x + w / 2, y + h / 2, 7);
        if (k === 'spears' && R.spearsNeed > 1) text(ctx, `${R.spears}/${R.spearsNeed}`, x + w / 2, y + h - 9, { size: 16, color: '#fff', weight: 700, stroke: 3 });
        // что это за ячейка: мышь — наведением, тап — подсказка на 4 с (ничего не тратит)
        const r = { x, y, w, h }, P = app.inp.pointer, msg = RITUAL_TIP[k](R);
        if (inRect(r, P)) { hoverTip('rit_' + k, msg, r); if (P.clicked && S.phase === 'play') { P.clicked = false; tapTip('rit_' + k, msg, r); } }
      });
      // порядок обряда — 16 px; не влезает в колонку — узкие «›» (в пиксельном шрифте их нет) или без пробелов
      const hint = ['шлем → щит → копья → обол → молния', ...(STYLE.pixel ? [] : ['шлем › щит › копья › обол › молния']), 'шлем→щит→копья→обол→молния'].find(t => measure(ctx, t, 16) <= 252) || 'шлем→щит→копья→обол→молния';
      text(ctx, hint, 819, 338, { size: 16, color: '#e6d2be', stroke: 3 });
    } else if (S.def.goal === 'water') {
      text(ctx, 'Найди воду: собери все пары', 819, 290, { size: 16, color: '#cfe6ff' });
    } else text(ctx, 'Имя ↔ щит сына', 819, 290, { size: 17, color: '#e9d2b8' });
    // кнопки «Вспомнить» и «Ликимний»
    // платные кнопки: первое нажатие (тап) объясняет, второе применяет — пока кнопка не изучена (save.seenTips)
    const inp = app.inp; let bx = 692;
    const paid = (id, r, label, msg, act, o, fn) => { if (inRect(r, inp.pointer) && !o.disabled) hoverTip(id, msg, r); if (button(ctx, inp, r.x, r.y, r.w, r.h, label, o) && gate(id, msg, r, act)) fn(); };
    if (S.def.recognize && S.phase === 'play') {
      paid('remember', { x: bx, y: 348, w: 126, h: 44 }, 'Вспомнить', 'Вспомнить: снова увидеть гребень и знак сына, чтобы отличить его шлем от чужих. Стоит 2 глотка.', 'Нажми ещё раз — вспомнить (−2 глотка).',
        { size: 17, disabled: S.water <= 2 }, () => { S.water -= 2; S.rememberT = 2.4; say(line('remember'), 'father', 2); sfx('air', { vol: 0.5 }); });
      bx += 132;
    }
    if (S.def.assoc && S.phase === 'play') {
      paid('rememberAll', { x: 700, y: 348, w: 240, h: 44 }, 'Вспомнить всех (−3)', 'Вспомнить всех: на миг показать имена и гербы всех сыновей. Стоит 3 глотка.', 'Нажми ещё раз — вспомнить (−3 глотка).',
        { size: 17, disabled: S.water <= 3 }, () => { S.water -= 3; S.rememberAllT = 3.2; say(line('remember'), 'father', 2); sfx('air', { vol: 0.5 }); });
    }
    if (app.save.licymnius && !S.hintUsed && S.phase === 'play' && !S.def.goal) {
      paid('lic', { x: bx, y: 348, w: 124, h: 44 }, 'Ликимний', 'Ликимний покажет, где лежит следующая вещь обряда. Один раз за поле.', 'Нажми ещё раз — позвать Ликимния.', { size: 17 }, useHint);
    }
  }
  // подсказки к ячейкам ряда обряда
  const RITUAL_TIP = {
    helm: () => S.son ? `Шлем сына: ${S.son.name}. С него начинается обряд.` : 'Шлем сына — с него начинается обряд.',
    shield: () => 'Щит — ложе для сына на костре.',
    spears: R => `Сломанные копья — дрова для костра. Нужно пар: ${R.spearsNeed}.`,
    coin: () => 'Обол — плата Харону. Берётся только после шлема сына.',
    bolt: () => 'Молния Зевса зажжёт костёр. Последней — когда всё собрано.',
  };
  // ---- подсказки: мышь — наведением, тап — показать на 4,5 с. Платное (дары, гроза, «Вспомнить», Ликимний)
  // с первого нажатия только объясняется, тратится вторым — пока элемент не изучен (save.seenTips[id])
  const inRect = (r, P) => P.x > r.x && P.x < r.x + r.w && P.y > r.y && P.y < r.y + r.h;
  function hoverTip(id, msg, r) { // вызывается каждый кадр, пока мышь над элементом
    if (app.inp.isTouch) return; // на телефоне «наведение» залипает в точке тапа
    const T = S.tip; if (T && T.id === id) { T.keep = true; return; }
    S.tip = { id, msg, r, t: 0, keep: true, life: 0 };
  }
  function tapTip(id, msg, r, act) { S.tip = { id, msg, act, r, t: 0, keep: true, life: 4.5 }; }
  function learnTip(id) { const o = app.save.seenTips ||= {}; if (!o[id]) { o[id] = 1; app.persist(); } }
  // нажатие на платный элемент: true — применить, false — показана подсказка «нажми ещё раз»
  function gate(id, msg, r, act) {
    const T = S.tip, read = T && T.id === id && ((!T.life && T.t > 0.35) || T.act); // мышь: подсказка уже висела; тап: второй раз
    if (app.save.seenTips?.[id] || read) { learnTip(id); S.tip = null; return true; }
    tapTip(id, msg, r, act); sfx('flip', { vol: 0.3, rate: 1.5 }); return false;
  }
  function drawTip(ctx) {
    const T = S.tip; if (!T) return;
    if (T.life ? T.t > T.life : !T.keep) { S.tip = null; return; }
    T.keep = false;
    const size = 17, lh = 21, maxW = 330;
    const lines = wrap(ctx, T.msg, maxW - 28, size), act = T.act ? wrap(ctx, T.act, maxW - 28, size) : [];
    const bw = Math.min(maxW, Math.max(...[...lines, ...act].map(l => measure(ctx, l, size))) + 32), bh = 16 + (lines.length + act.length) * lh;
    // под элементом; у нижней половины экрана — над ним (не закрывать реплику в колонке)
    const r = T.r; let bx = clamp(r.x + r.w / 2 - bw / 2, 8, W - bw - 8), by = r.y + r.h + 8; if (by + bh > H - 8 || r.y > 300) by = Math.max(8, r.y - bh - 8);
    const a = Math.min(1, T.t * 6, T.life ? (T.life - T.t) * 3 : 1);
    ctx.save(); ctx.globalAlpha = a;
    if (T.act) { const p = 0.55 + 0.45 * Math.sin(S.time * 8); ctx.strokeStyle = `rgba(255,214,140,${p})`; ctx.lineWidth = STYLE.pixel ? 4 : 2.5; ctx.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6); }
    if (!STYLE.pixel) { ctx.fillStyle = '#0a0607'; ctx.fillRect(bx, by, bw, bh); } // непрозрачно: текст под подсказкой не просвечивает
    comicBox(ctx, bx, by, bw, bh, 0.97);
    lines.forEach((l, i) => text(ctx, l, bx + bw / 2, by + 8 + lh / 2 + i * lh, { size, color: '#fff0d8' }));
    act.forEach((l, i) => text(ctx, l, bx + bw / 2, by + 8 + lh / 2 + (lines.length + i) * lh, { size, color: '#ffcf7a', weight: 700 }));
    ctx.restore();
  }
  function useHint() {
    const R = S.ritual;
    const need = !R.helm ? 'helm' : !R.shield ? 'shield' : R.spears < R.spearsNeed ? 'spears' : !R.coin ? 'coin' : 'bolt';
    const c = S.cards.find(c => c.type === need && !c.matched && !c.open);
    if (!c) return;
    S.hintUsed = true; c.hint = 3.2; say(line('hint'), 'lic', 3); sfx('air', { vol: 0.4 });
  }

  function drawAltar(ctx) {
    const A = S.altar, R = S.ritual, s = A.s;
    if (S.def.goal) return;
    ctx.save(); ctx.translate(A.x, A.y); ctx.scale(s, s);
    // земля и тень
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(0, 44, 84, 18, 0, 0, TAU); ctx.fill();
    // дрова — куча сломанных копий (Kontext по карте автора); растёт с каждой парой копий
    const need = Math.max(1, R.spearsNeed), have = Math.min(need, R.spears) + (S.phase === 'pyre' ? need : 0);
    if (have > 0) { const li = img('pyre_logs'); if (li) { const k = Math.min(1, 0.6 + 0.4 * have / need), lw = 250 * k, lh = lw * li.height / li.width; if (STYLE.pixel) ctx.imageSmoothingEnabled = false; ctx.drawImage(li, -lw / 2, 78 - lh, lw, lh); } }
    // ложе и тело
    const stage = R.coin ? 'pyre_coins' : (R.helm && R.shield) ? 'pyre_helm' : R.shield ? 'pyre0' : null;
    const sz = STYLE.pixel ? [110, 150] : stage === 'pyre0' ? [124, 149] : [128, 154];
    if (stage && !(STYLE.pixel && S.pyre?.struck)) { const im = img(stage); if (im) ctx.drawImage(im, -sz[0] / 2, -66, sz[0], sz[1]); }
    else if (R.helm) { ctx.globalAlpha = 0.55; const im = img('pyre_helm'); if (im) ctx.drawImage(im, -64, -66, 128, 154); ctx.globalAlpha = 1; }
    else if (STYLE.pixel) { ctx.globalAlpha = 0.35; pxRing(ctx, 0, 4, 56, '#e6d2be'); ctx.globalAlpha = 1; }
    else { ctx.strokeStyle = 'rgba(230,210,190,0.25)'; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.ellipse(0, 4, 56, 56, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    // огонь
    if (S.pyre && S.pyre.struck) {
      if (STYLE.pixel) { const fp = img('fire_px'), fr = Math.min(18, Math.floor((S.pyre.t - 1.4) * 8)) % 19; if (fp) { ctx.imageSmoothingEnabled = false; ctx.drawImage(fp, fr * 22, 0, 22, 30, -66, -90, 132, 180); } ctx.restore(); return; }
      const fi = img('fire_hq'); const ft = (S.pyre.t - 1.4) * 14; const fr = ft < 8 ? 4 + Math.floor(ft) : 12 + Math.floor(ft - 8) % 20; const k = Math.min(1, (S.pyre.t - 1.4) / 1.2);
      if (fi) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9; const sc = 0.75 + k * 0.45; ctx.drawImage(fi, (fr % 8) * 240, Math.floor(fr / 8) * 427, 240, 427, -120 * sc, -330 * sc + 70, 240 * sc, 427 * sc); }
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 160); g.addColorStop(0, `rgba(255,170,80,${0.35 * k})`); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(0, 0, 160, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawHUD(ctx, inp) {
    // жажда
    // заголовок
    text(ctx, `${S.def.title} · ${S.def.sub}`, 572, 26, { size: 18, sc: true, spacing: 1.5, color: '#ead6c0' });
    if (S.son) { drawBadge(ctx, S.son, 572 - 50, 48, 8); text(ctx, S.son.name, 572 - 36, 48, { size: 16, align: 'left', color: S.son.crest === '#111' ? '#e0b0b0' : '#e8dccc' }); }
    // дары
    if (!['pyre', 'result', 'dead'].includes(S.phase)) {
      GIFTS.forEach((g, i) => {
        const x = 728 + i * 56, y = 8, w = 48, h = 50, cnt = app.save.gifts[g.id] || 0;
        const P = inp.pointer, r = { x, y, w, h }, hov = inRect(r, P), id = 'g_' + g.id, msg = tr(g.name) + ': ' + tr(g.tip); // по частям: склейка целиком не переводится
        const none = msg + '\n' + tr('Пока нет: дары дают за серии точных пар.');
        drawMedallion(ctx, img(g.img), x + w / 2, y + h / 2, 22, cnt, hov && cnt > 0);
        if (hov) hoverTip(id, cnt > 0 ? msg : none, r);
        if (hov && P.clicked) {
          P.clicked = false;
          // в обучении тренер сам объясняет дар — применить сразу
          const coach = S.coach && S.coach.step === g.id;
          if (cnt <= 0) tapTip(id, none, r);
          else if (S.phase === 'play' && S.resolveT <= 0) { if (coach) { learnTip(id); useGift(g.id); } else if (gate(id, msg, r, 'Нажми ещё раз, чтобы призвать.')) useGift(g.id); }
          else tapTip(id, msg, r);
        }
      });
      if (pauseButton(ctx, inp, 908, 12)) S.paused = true;
    }
  }
  // вода — самое важное: крупно, поверх виньетки; глоток = капля, пустые капли — сколько можно добрать до максимума
  function drawWater(ctx) {
    if (['pyre', 'result', 'dead', 'lament'].includes(S.phase) && S.phase !== 'dead') return;
    if (!STYLE.pixel) return drawWaterMedal(ctx);
    const low = S.water <= 2 && S.phase === 'play', shake = low ? Math.sin(S.time * 20) * 1.5 : 0;
    const x = 8, y = 6, n = Math.max(S.maxWater, S.water), dw = n > 11 ? 10 : 12, w = 92 + n * dw, h = 52; S.waterW = w;
    ctx.save();
    if (STYLE.pixel) pxPanel(ctx, x, y, w, h, { frame: low ? '#c01b17' : '#00a0c8' });
    else { ctx.fillStyle = 'rgba(10,8,14,0.72)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.strokeStyle = low ? `rgba(255,110,90,${0.6 + 0.4 * Math.sin(S.time * 8)})` : 'rgba(120,180,230,0.55)'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
    drawAmphora(ctx, x + 26 + shake, y + 27, 0.42, S.water / Math.max(1, S.maxWater), '', low, S.time);
    text(ctx, String(S.water), x + 66 + shake, y + 28, { size: 30, sc: true, weight: 700, color: low ? '#ff8a7a' : '#bfe4ff', stroke: 3 });
    for (let i = 0; i < n; i++) {
      const cx = x + 88 + i * dw + dw / 2, cy = y + 28, full = i < S.water;
      ctx.fillStyle = full ? (low ? '#ff6b5a' : '#5fb4f0') : 'rgba(150,170,200,0.22)';
      if (STYLE.pixel) { ctx.fillRect(cx - 3, cy - 2, 6, 8); ctx.fillRect(cx - 1, cy - 6, 2, 4); }
      else { ctx.beginPath(); ctx.moveTo(cx, cy - 9); ctx.quadraticCurveTo(cx + 5, cy - 1, cx + 4, cy + 3); ctx.arc(cx, cy + 3, 4, 0, Math.PI); ctx.quadraticCurveTo(cx - 5, cy - 1, cx, cy - 9); ctx.fill(); }
    }
  }
  // живописная версия: вода и гроза — бронзовые медальоны, как дары (drawMedallion в gfx.js)
  function bronzeDisc(ctx, x, y, r, hot) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(x + 2, y + 3, r, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 2, x, y, r); g.addColorStop(0, hot ? '#f0c27a' : '#c99a56'); g.addColorStop(1, '#5a3a1a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  // вода: медальон с амфорой (уровень = глотки) + бронзовый картуш «сейчас / максимум» и капли; ≤ 2 — красное, дрожит
  function drawWaterMedal(ctx) {
    const low = S.water <= 2 && S.phase === 'play', sh = low ? Math.sin(S.time * 20) * 1.2 : 0, pulse = low ? 0.5 + 0.5 * Math.sin(S.time * 8) : 0;
    const cx = 36 + sh, cy = 33, r = 27, n = Math.max(S.maxWater, S.water), dw = n > 11 ? 10 : 12;
    const px = 58, py = 15, ph = 36, pw = 80 + n * dw; S.waterW = px + pw - 6;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(px + 2, py + 3, pw, ph, ph / 2); ctx.fill();
    const gp = ctx.createLinearGradient(0, py, 0, py + ph); gp.addColorStop(0, low ? '#d08a6a' : '#b88a4c'); gp.addColorStop(1, low ? '#4a1810' : '#4a2e14');
    ctx.fillStyle = gp; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = low ? `rgba(${40 + 30 * pulse},8,8,0.93)` : 'rgba(12,10,16,0.9)'; ctx.beginPath(); ctx.roundRect(px + 3, py + 3, pw - 6, ph - 6, ph / 2 - 3); ctx.fill();
    bronzeDisc(ctx, cx, cy, r, false);
    if (low) { ctx.fillStyle = `rgba(255,70,50,${0.25 + 0.4 * pulse})`; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#120c10'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,8,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, 0, TAU); ctx.clip();
    drawAmphora(ctx, cx, cy - 1, 0.4, S.water / Math.max(1, S.maxWater), '', low, S.time);
    ctx.restore();
    for (let i = 0; i < n; i++) {
      const dx = px + 72 + i * dw + dw / 2, dy = cy;
      ctx.fillStyle = i < S.water ? (low ? '#ff6b5a' : '#5fb4f0') : 'rgba(150,170,200,0.2)';
      ctx.beginPath(); ctx.moveTo(dx, dy - 9); ctx.quadraticCurveTo(dx + 5, dy - 1, dx + 4, dy + 3); ctx.arc(dx, dy + 3, 4, 0, Math.PI); ctx.quadraticCurveTo(dx - 5, dy - 1, dx, dy - 9); ctx.fill();
    }
    ctx.restore();
    text(ctx, String(S.water), px + 24 + sh, cy + 1, { size: 30, sc: true, weight: 700, color: low ? '#ff8a7a' : '#d8ecff', stroke: 3 });
    text(ctx, '/' + S.maxWater, px + 42, cy + 5, { size: 16, sc: true, align: 'left', color: low ? '#e0a090' : '#9fb6cc', stroke: 2 });
  }
  // гроза: медальон с тучей; насечки по ободу — заряд (одна за попытку); полный — светится, нажми или пробел
  function drawStormMedal(ctx, x, y, w, h, ready, hov, pulse) {
    const cx = x + 26, cy = y + 27, r = 24, n = S.flashEvery, left = n - S.storm;
    ctx.save();
    if (ready) { ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = 10 + pulse * 16; }
    bronzeDisc(ctx, cx, cy, r, ready || hov); ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i * TAU / n + 0.07, a1 = -Math.PI / 2 + (i + 1) * TAU / n - 0.07;
      ctx.strokeStyle = ready ? `rgba(255,236,160,${0.75 + 0.25 * pulse})` : i < S.storm ? '#ffe08a' : 'rgba(30,18,8,0.8)';
      ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(cx, cy, r * 0.88, a0, a1); ctx.stroke();
    }
    const gi = ctx.createRadialGradient(cx, cy - 6, 2, cx, cy, r * 0.74); gi.addColorStop(0, ready ? '#454b7a' : '#262a3c'); gi.addColorStop(1, '#0c0d16');
    ctx.fillStyle = gi; ctx.beginPath(); ctx.arc(cx, cy, r * 0.74, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,8,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = ready ? '#dfe2f4' : '#6e7490';
    for (const [ox, oy, rr] of [[-7, -4, 5.5], [0, -8, 7], [7, -4, 5.5]]) { ctx.beginPath(); ctx.arc(cx + ox, cy + oy, rr, 0, TAU); ctx.fill(); }
    if (ready) { ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = 8; }
    ctx.fillStyle = ready ? '#ffe08a' : '#8a7a4a'; ctx.beginPath();
    for (const [i, [bx, by]] of [[1, 0], [-3.5, 8], [0, 7.5], [-2, 14], [4.5, 4.5], [1, 5]].entries()) i ? ctx.lineTo(cx + bx, cy + by) : ctx.moveTo(cx + bx, cy + by);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    if (!ready) text(ctx, String(left), cx + r * 0.74, cy + r * 0.64, { size: 16, color: '#ffe0a8', weight: 700, stroke: 3 });
    // подписи ≥16 px; пояснение при наведении/тапе — общей подсказкой drawTip
    if (ready) { text(ctx, 'Молния готова', x + 58, y + 17, { size: 17, align: 'left', sc: true, color: '#ffe08a', stroke: 3 }); text(ctx, 'нажми или пробел', x + 58, y + 38, { size: 16, align: 'left', color: '#f4ead2', stroke: 3 }); }
    else { text(ctx, 'Гроза', x + 58, y + 17, { size: 17, align: 'left', sc: true, color: '#dde2f2', stroke: 3 }); text(ctx, 'ходов до молнии: ' + left, x + 58, y + 38, { size: 16, align: 'left', color: '#d4d8ea', stroke: 3 }); }
  }
  function useGift(id) {
    if (S.coach && COACH[S.coach.step]?.block && !((S.coach.step === 'gaze' && id === 'gaze') || (S.coach.step === 'flash' && id === 'flash'))) return;
    if (id === 'gaze') { S.gazeMode = !S.gazeMode; if (S.gazeMode) coachEvent('gazeMode'); return; }
    if (id === 'flash') coachEvent('flashUsed');
    app.save.gifts[id]--; S.giftsUsed++; app.persist();
    if (id === 'flash') { lightningFlash(0.75); S.flashA = 1; }
    if (id === 'amph') { S.water = Math.min(S.maxWater + 2, S.water + 4); sfx('drink', { vol: 0.8 }); floater(120, 60, '+4', '#9fd0ff'); }
  }

  function drawIntro(ctx) {
    const k = Math.min(1, S.pt * 2.5), out = S.pt > (S.son ? 3.1 : 1.2) ? 1 - (S.pt - (S.son ? 3.1 : 1.2)) * 2 : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, k * out);
    ctx.fillStyle = 'rgba(6,3,5,0.8)'; ctx.fillRect(0, 0, W, H);
    text(ctx, S.def.title, W / 2, 120, { size: 22, sc: true, color: '#c9a98e', spacing: 3 });
    text(ctx, S.def.sub, W / 2, 158, { size: 40, sc: true, spacing: 2 });
    if (S.son) {
      drawBadge(ctx, S.son, W / 2, 268, 58);
      text(ctx, S.son.name, W / 2, 352, { size: 34, sc: true, color: '#f2e2cc' });
      text(ctx, S.son.sign, W / 2, 386, { size: 18, color: '#d9c2a8' });
      wrap(ctx, S.son.about, 560, 17).forEach((l, i) => text(ctx, l, W / 2, 420 + i * 22, { size: 17, color: '#bfa996' }));
      if (S.def.recognize) text(ctx, 'Запомни гребень и знак: среди тел есть чужие шлемы.', W / 2, 482, { size: 16, color: '#ffcf7a' });
    }
    if (S.mods.omen) text(ctx, `Знамение «${S.mods.omen.name}»: ${S.mods.omen.minus}`, W / 2, 512, { size: 16, color: '#c9b4e8' });
    const rl = S.mods.relics || [], extra = [S.mods.wrath ? `Гнев Ареса ${S.mods.wrath}` : '', rl.length ? 'Реликвии: ' + rl.map(id => tr(relicName(id))).join(', ') : '', S.mods.pity ? `Упрямство отца: +${S.mods.pity} глоток` : ''].filter(Boolean);
    if (extra.length) text(ctx, extra.join(' · '), W / 2, S.son ? 190 : 200, { size: 16, color: '#ff9a8a' });
    ctx.restore();
  }
  function drawRemember(ctx) {
    const a = Math.min(1, S.rememberT * 3, (2.4 - S.rememberT) * 6);
    ctx.save(); ctx.globalAlpha = a; comicBox(ctx, 230, 150, 420, 230);
    drawBadge(ctx, S.son, 340, 265, 62); text(ctx, S.son.name, 520, 235, { size: 30, sc: true }); wrap(ctx, S.son.sign, 200, 17).forEach((l, i) => text(ctx, l, 520, 275 + i * 22, { size: 17, color: '#d9c2a8' }));
    ctx.restore();
  }

  function drawRememberAll(ctx) {
    const a = Math.min(1, S.rememberAllT * 3, (3.2 - S.rememberAllT) * 6);
    ctx.save(); ctx.globalAlpha = a; comicBox(ctx, 90, 90, 600, 380);
    SONS.forEach((s, i) => { const x = 130 + (i % 4) * 140, y = 170 + Math.floor(i / 4) * 170; drawBadge(ctx, s, x + 30, y, 36); text(ctx, s.name, x + 30, y + 58, { size: 18, sc: true }); });
    ctx.restore();
  }
  function drawLament(ctx) {
    const L = S.lament;
    ctx.fillStyle = 'rgba(6,3,5,0.55)'; ctx.fillRect(0, 0, W, H);
    text(ctx, 'Плач', W / 2, 96, { size: 38, sc: true, spacing: 3 });
    text(ctx, L.show ? 'Слушай напев…' : `Повтори: ${L.input.length} / ${L.seq.length}`, W / 2, 134, { size: 18, color: '#d9c2a8' });
    // лира: рога, перекладина, черепаховый корпус, 5 струн с цветными колками
    if (STYLE.pixel) { const P = app.inp.pointer, xs = [0, 1, 2, 3, 4].map(LYRE_X); pxLyre(ctx, { xs, y0: LY0, y1: LY1, lit: L.flash[0], litK: L.flash[1], hover: L.show ? -1 : xs.findIndex(x => Math.abs(P.x - x) < 29 && P.y > LY0 - 10 && P.y < LY1 + 20), cols: STR_COL, t: S.time }); return; }
    ctx.save(); ctx.lineCap = 'round';
    const xl = LYRE_X(0) - 46, xr = LYRE_X(4) + 46;
    for (const [side, x0] of [[-1, xl], [1, xr]]) {
      ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(x0 - side * 6, LY1 + 26); ctx.bezierCurveTo(x0 + side * 46, LY1 - 40, x0 + side * 54, LY0 + 40, x0 + side * 4, LY0 - 34); ctx.stroke();
      ctx.strokeStyle = '#c9954f'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x0 - side * 6, LY1 + 26); ctx.bezierCurveTo(x0 + side * 46, LY1 - 40, x0 + side * 54, LY0 + 40, x0 + side * 4, LY0 - 34); ctx.stroke();
      ctx.fillStyle = '#e8c27a'; ctx.beginPath(); ctx.arc(x0 + side * 4, LY0 - 36, 7, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#8a5a2c'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(xl - 6, LY0 - 14); ctx.lineTo(xr + 6, LY0 - 14); ctx.stroke();
    // корпус-панцирь
    const bx = 480, by = LY1 + 30;
    const gb = ctx.createRadialGradient(bx, by - 10, 10, bx, by, 150); gb.addColorStop(0, '#7a5230'); gb.addColorStop(1, '#2e1c10');
    ctx.fillStyle = gb; ctx.beginPath(); ctx.ellipse(bx, by, 150, 34, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(230,190,120,0.35)'; ctx.lineWidth = 1.5; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(bx + k * 48, by, 22, 20, 0, 0, TAU); ctx.stroke(); }
    for (let i = 0; i < 5; i++) {
      const lit = L.flash[0] === i && L.flash[1] > 0, x = LYRE_X(i), vib = lit ? Math.sin(S.time * 80) * 3 * L.flash[1] : 0;
      if (!L.show) { const P = app.inp.pointer; if (Math.abs(P.x - x) < 29 && P.y > LY0 - 10 && P.y < LY1 + 20) { ctx.fillStyle = 'rgba(255,220,160,0.10)'; ctx.fillRect(x - 28, LY0 - 10, 56, LY1 - LY0 + 30); } }
      ctx.strokeStyle = lit ? '#fff2c0' : '#e3d6bc'; ctx.lineWidth = lit ? 3.5 : 2; ctx.shadowColor = lit ? STR_COL[i] : 'transparent'; ctx.shadowBlur = lit ? 22 : 0;
      ctx.beginPath(); ctx.moveTo(x, LY0 - 14); ctx.quadraticCurveTo(x + vib, (LY0 + LY1) / 2, x + (x - 480) * -0.12, LY1 + 22); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = STR_COL[i]; ctx.beginPath(); ctx.arc(x, LY0 - 14, lit ? 9 : 6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawPyreOverlay(ctx) {
    const P = S.pyre;
    if (P.soul) drawSoul(ctx, S.altar.x + Math.sin(P.soul.t * 2) * 14, P.soul.y, 12, Math.min(1, P.soul.t), P.soul.t);
    if (P.t > 6.2 && S.son) { const a = Math.min(1, (P.t - 6.2) * 1.5); ctx.save(); ctx.globalAlpha = a; text(ctx, '✦', S.altar.x, 70, { size: 30, color: '#fff3d6' }); text(ctx, `Звезда — ${S.son.name}`, S.altar.x, 104, { size: 20, sc: true, color: '#f3dcc0' }); ctx.restore(); }
  }

  function drawResult(ctx, inp) {
    const R = S.result, a = Math.min(1, S.pt * 2);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(6,3,5,0.6)'; ctx.fillRect(0, 0, W, H);
    comicBox(ctx, W / 2 - 220, 110, 440, 290);
    const title = S.def.goal === 'water' ? 'Силы вернулись' : S.def.goal === 'names' ? 'Все названы' : (S.son ? S.son.name + ' на пути к Стиксу' : 'Костёр горит');
    text(ctx, title, W / 2, 150, { size: 28, sc: true });
    for (let i = 0; i < 3; i++) starIcon(ctx, W / 2 - 60 + i * 60, 205, 22, i < R.stars);
    text(ctx, `Попыток: ${R.attempts}   Промахов: ${R.misses}   Время: ${Math.floor(R.time / 60)}:${String(Math.floor(R.time % 60)).padStart(2, '0')}`, W / 2, 255, { size: 17, color: '#d9c2a8' });
    text(ctx, `Глотков осталось: ${R.water}     Осколки памяти: +${R.shards}`, W / 2, 282, { size: 17, color: '#9fd0ff' });
    ctx.restore();
    if (S.pt > 0.6 && button(ctx, inp, W / 2 - 110, 320, 220, 52, 'Дальше', { key: 'Enter' })) app.next();
  }
  function drawDead(ctx, inp) {
    const a = Math.min(1, S.pt * 1.2);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(4,2,3,0.82)'; ctx.fillRect(0, 0, W, H);
    const im = img('c_styx'); if (im) { ctx.globalAlpha = a * 0.35; drawCam(ctx, im, [0.42, 0.5, 1.3]); ctx.globalAlpha = a; }
    text(ctx, 'Жажда победила', W / 2, 150, { size: 40, sc: true, color: '#e6c9b0' });
    text(ctx, 'Поле перемешается заново. Сыновья ждут.', W / 2, 196, { size: 18, color: '#bfa996' });
    ctx.restore();
    if (S.pt > 1.2) {
      if (button(ctx, inp, W / 2 - 120, 250, 240, 54, 'Встать снова', { key: 'Enter' })) { setDrone(0); scene.enter(null, { id: S.id, tries: S.tries + 1 }); }
      if (button(ctx, inp, W / 2 - 120, 316, 240, 50, 'В меню')) { setDrone(0); app.goMenu(); }
    }
  }
  // гроза: туча копит заряд — по ходу за попытку; полная туча — нажми (или пробел), и молния осветит поле
  function stormReady() { return S.flashEvery && S.storm >= S.flashEvery; }
  function useStorm() { if (!stormReady() || S.phase !== 'play' || S.resolveT > 0) return; S.storm = 0; lightningFlash(0.8); S.flashA = 1; sfx('bolt', { vol: 0.5 }); }
  function drawStorm(ctx, inp) {
    if (!S.flashEvery || !['play', 'preview'].includes(S.phase)) return;
    const x = S.waterW + 16, y = 6, w = STYLE.pixel ? 196 : 172, h = 52, ready = stormReady(), P = inp.pointer;
    const r = { x, y, w, h }, hov = inRect(r, P);
    const info = 'Гроза: каждый ход копит заряд. Полная туча — нажми, и молния осветит всё поле.', boom = 'Молния осветит всё поле на миг — запоминай, что увидишь.';
    if (hov) hoverTip('storm', ready ? boom : info, r);
    if (ready && inp.uiHit('Space')) { learnTip('storm'); useStorm(); } // пробел — осознанное действие, без подсказки
    else if (hov && P.clicked) { P.clicked = false; if (ready) { if (gate('storm', boom, r, 'Нажми ещё раз — ударит молния.')) useStorm(); } else tapTip('storm_i', info, r); }
    const pulse = ready ? 0.5 + 0.5 * Math.sin(S.time * 6) : 0;
    if (!STYLE.pixel) return drawStormMedal(ctx, x, y, w, h, ready, hov, pulse);
    ctx.save();
    if (STYLE.pixel) pxPanel(ctx, x, y, w, h, { frame: ready ? '#ffe08a' : '#737464' });
    else { ctx.fillStyle = 'rgba(10,8,14,0.72)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.strokeStyle = ready ? `rgba(255,224,138,${0.6 + pulse * 0.4})` : 'rgba(180,185,210,0.35)'; ctx.lineWidth = 2; ctx.stroke(); }
    if (ready) { ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = 10 + pulse * 14; }
    if (STYLE.pixel) { ctx.shadowBlur = 0; pxIcon(ctx, 'cloud', x + 30, y + 20, 4, ready ? null : { e: '#7a8098', G: '#4a5068' }); pxIcon(ctx, 'bolt', x + 30, y + 38, 2, ready ? null : { n: '#8a7a4a', y: '#6a5a3a' }); }
    else { ctx.fillStyle = ready ? '#d8dcf0' : '#7a8098'; for (const [cx, cy, r] of [[x + 20, y + 26, 9], [x + 30, y + 20, 11], [x + 41, y + 26, 9]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); }
    ctx.fillStyle = ready ? '#ffe08a' : '#8a7a4a'; ctx.beginPath(); ctx.moveTo(x + 31, y + 28); ctx.lineTo(x + 25, y + 40); ctx.lineTo(x + 30, y + 39); ctx.lineTo(x + 27, y + 49); ctx.lineTo(x + 36, y + 35); ctx.lineTo(x + 31, y + 36); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    if (ready) { text(ctx, 'Молния готова', x + 58, y + 18, { size: 16, align: 'left', sc: true, color: '#ffe08a' }); text(ctx, 'нажми — молния', x + 58, y + 38, { size: 16, align: 'left', color: '#f0e4c8' }); }
    else {
      // пиксельная версия: «ещё N» — в строке заголовка, насечки заряда — по сетке 4 на всю ширину плашки
      const n = S.flashEvery, pitch = Math.max(8, Math.floor((w - 64) / n / 4) * 4), x0 = Math.round((x + 58) / 4) * 4;
      text(ctx, 'Гроза', x + 58, y + 16, { size: 16, align: 'left', sc: true, color: '#dde2f2' });
      text(ctx, `ещё ${n - S.storm}`, x + w - 10, y + 16, { size: 16, align: 'right', color: '#c4cade' });
      for (let i = 0; i < n; i++) { ctx.fillStyle = i < S.storm ? '#ffe08a' : '#3a4250'; ctx.fillRect(x0 + i * pitch, y + 30, pitch - 4, 12); }
    }
  }
  function drawFlyby(ctx, f) {
    const x = f.dir > 0 ? -40 + f.t * 230 : W + 40 - f.t * 230, y = f.y + Math.sin(f.t * 3) * 12;
    for (let i = 0; i < 3; i++) drawBird(ctx, x - i * 30 * f.dir, y + i * 14, f.t * 9 + i, f.dir, 0.8);
  }
  // ворон: подлетает и зависает над целями (знак), держится над ними, пока вещи меняются местами, и улетает
  function drawRaven(ctx, b) {
    // зависает над серединой стрелки знака (как в drawTele: изгиб вверх на четверть расстояния)
    const w = b.wait || 0, ch = S.L.ch, x0 = b.a.x, y0 = b.a.y - ch * 0.25, x1 = b.b.x, y1 = b.b.y - ch * 0.25, d = Math.hypot(x1 - x0, y1 - y0) || 1;
    let nx = -(y1 - y0) / d, ny = (x1 - x0) / d; if (ny < 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
    const bend = -Math.max(40, d * 0.25) * 0.5, mx = (x0 + x1) / 2 + nx * bend, my = (y0 + y1) / 2 + ny * bend - 18, fly = Math.max(0.3, w * 0.7);
    let x, y;
    if (b.t < fly) { const k = ease.outCubic(b.t / fly); x = lerp(b.x0, mx, k); y = lerp(b.y0, my, k) - Math.sin(k * Math.PI) * 50; }
    else if (b.t < w + 0.75) { x = mx + Math.sin(b.t * 7) * 6; y = my + Math.sin(b.t * 11) * 3; }
    else { const k = (b.t - w - 0.75) / 0.55; x = mx + k * 160 * (b.a.x > b.x0 ? 1 : -1); y = my - k * 140; }
    // красный ореол: чёрный ворон не теряется ни на тёмном фоне, ни на чёрных пиксельных рубашках
    if (b.t < w + 0.75) { ctx.save(); ctx.fillStyle = 'rgba(255,92,72,0.45)'; ctx.beginPath(); ctx.arc(x, y, STYLE.pixel ? 20 : 22, 0, TAU); ctx.fill(); ctx.restore(); }
    drawBird(ctx, x, y, b.t * 16, b.a.x > b.x0 ? 1 : -1, 1.6);
  }
  // знаки перестановок: кольца на картах, которые сейчас поедут, и стрелки — куда
  function drawTele(ctx) {
    if (!S.tele.length) return;
    const { cw, ch } = S.L, px = STYLE.pixel;
    for (const T of S.tele) {
      const k = T.t / T.dur, p = 0.6 + 0.4 * Math.sin(S.time * 20), a = Math.min(1, T.t * 8, (T.dur - T.t) * 10 + 0.2);
      const col = T.kind === 'raven' ? [255, 92, 72] : T.kind === 'hound' ? [255, 156, 60] : [255, 176, 80];
      const rgba = al => `rgba(${col[0]},${col[1]},${col[2]},${al})`;
      ctx.save(); ctx.globalAlpha = a;
      if (T.kind === 'deimos') {
        const idx = []; for (let c = 0; c < S.cols; c++) { const i = T.r * S.cols + c; if (i < S.L.n) idx.push(i); }
        const sl = idx.map(i => S.L.slots[i]); if (!sl.length) { ctx.restore(); continue; }
        const y0 = sl[0].y - ch / 2 - 6, x0 = sl[0].x - cw / 2 - 6, x1 = sl[sl.length - 1].x + cw / 2 + 6;
        ctx.fillStyle = rgba(0.10 + 0.12 * p); ctx.fillRect(x0, y0, x1 - x0, ch + 12);
        ctx.strokeStyle = rgba(0.9 * p); ctx.lineWidth = px ? 4 : 3; ctx.strokeRect(x0, y0, x1 - x0, ch + 12);
        // шевроны между картами: каждая карта уходит на место правой соседки
        for (let i = 0; i < sl.length - 1; i++) chevron(ctx, (sl[i].x + sl[i + 1].x) / 2 + Math.sin(S.time * 10) * 3, sl[i].y, 0, rgba(1));
        // крайняя правая перелетает в начало ряда — дуга над рядом (у верхнего ряда — под ним)
        const up = T.r > 0 || S.L.slots.length <= S.cols, ay = up ? y0 - 4 : y0 + ch + 16;
        arrow(ctx, sl[sl.length - 1].x, ay, sl[0].x, ay, up ? -34 : 34, rgba(1), false, k);
      } else {
        for (const c of [T.a, T.b]) { ctx.strokeStyle = rgba(p); ctx.lineWidth = px ? 4 : 3.5; ctx.strokeRect(c.x - cw / 2 - 5, c.y - ch / 2 - 5, cw + 10, ch + 10); }
        // стрелка в обе стороны: вещи меняются местами
        const bend = -Math.max(40, Math.hypot(T.a.x - T.b.x, T.a.y - T.b.y) * 0.25);
        arrow(ctx, T.a.x, T.a.y - ch * 0.25, T.b.x, T.b.y - ch * 0.25, bend, rgba(1), true, k);
      }
      ctx.restore();
    }
  }
  // стрелка-дуга (квадратичная кривая), пунктир бежит; both — наконечники с обеих сторон
  function arrow(ctx, x0, y0, x1, y1, bend, col, both, k) {
    // нормаль смотрит вниз экрана: bend < 0 — дуга выгибается вверх при любом направлении стрелки
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nl = Math.hypot(x1 - x0, y1 - y0) || 1;
    let nx = -(y1 - y0) / nl, ny = (x1 - x0) / nl; if (ny < 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
    const qx = mx + nx * bend, qy = my + ny * bend;
    const P = t => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * qx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * qy + t * t * y1];
    ctx.fillStyle = col; ctx.strokeStyle = col;
    // пиксели: штрихи 2×2 пикселя арта, бегущий пунктир (точки 1×1 путались с дождём)
    if (STYLE.pixel) { const off = (S.time * 2) % 1; for (let i = 0; i < 24; i++) { if ((i + Math.floor(off * 3)) % 3 === 2) continue; const [x, y] = P(i / 23); ctx.fillRect(Math.round(x / 4) * 4 - 4, Math.round(y / 4) * 4 - 4, 8, 8); } }
    else {
      ctx.lineWidth = 4; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -S.time * 40; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(qx, qy, x1, y1); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
    }
    const head = (t0, t1) => { const [ax, ay] = P(t0), [bx, by] = P(t1), ang = Math.atan2(ay - by, ax - bx); chevron(ctx, ax, ay, ang, col, true); };
    head(1, 0.9); if (both) head(0, 0.1);
  }
  // наконечник/шеврон: треугольник, смотрит по углу ang
  function chevron(ctx, x, y, ang, col, solid) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = col;
    if (!STYLE.pixel) { ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 5; }
    ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-10, -9); ctx.lineTo(solid ? -6 : -4, 0); ctx.lineTo(-10, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawBird(ctx, x, y, ph, dir, s) {
    if (STYLE.pixel) return pxBird(ctx, x, y, ph, dir, s > 1.2 ? 4 : 2);
    const f = Math.sin(ph) * 0.8;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s); ctx.fillStyle = '#0a0708';
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 3.5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.quadraticCurveTo(-8, -14 * f, -18, -10 * f - 2); ctx.quadraticCurveTo(-8, -2, 2, 1); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.quadraticCurveTo(6, -12 * f, 14, -8 * f - 1); ctx.quadraticCurveTo(6, -1, 4, 1); ctx.fill();
    ctx.beginPath(); ctx.moveTo(9, -1); ctx.lineTo(14, 0); ctx.lineTo(9, 1.5); ctx.fill();
    ctx.restore();
  }

  return scene;
}
import { relicOf } from './progress.js';
const relicName = id => relicOf(id)?.name || id;
// приглушение музыки (импорт здесь, чтобы не тянуть в шапку)
import { musicDuck } from '../engine/audio.js';
