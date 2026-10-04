// Прогрессия v4: данные и чистая логика (без холста). Сила — только ступени алтаря и с жёстким потолком (измерен ботом);
// остальное — разнообразие (знамения, реликвии, рубашки) и давление (Гнев Ареса). Подробности — docs/GDD.md «Прогрессия v4».
//
// Навсегда (save): shards, up, side, unlocked, wrath.max/sel, cos, ach, best.
// На забег — один проход кампании (save.run): wrath (ступень Гнева), relics, drafted, fails. Сбрасывается в newGame()/wipeSave().

// ---- Алтарь памяти: ступени облегчения (свет) и тень. Эффект ступеней мал и убывает, цена растёт ×2,2–2,5.
// fx(lv) — числа для runMods (meta.js); steps[i] — описание и цена i-й ступени. Потолок суммы: FULL ≤ +15 п. п. к победам бота (docs/progress.md).
export const UPGRADES = [
  { id: 'water', name: 'Широкая амфора', steps: [{ cost: 36, desc: 'Победа: +1 осколок за каждый оставшийся глоток (до 4)' }, { cost: 90, desc: 'До 8 осколков за оставшиеся глотки' }],
    fx: lv => ({ waterShards: 4 * lv }),   // только доход осколков: на победы не влияет
    shadow: { name: 'Сухое горло', desc: '−1 глоток; 3 точные пары подряд — +1 глоток', mul: 0.25 } },
  { id: 'preview', name: 'Зоркий глаз', steps: [{ cost: 16, desc: 'Показ карт в начале поля длиннее на 0,05 с' }, { cost: 40, desc: 'Ещё на 0,05 с' }, { cost: 90, desc: 'Ещё на 0,05 с' }],
    fx: lv => ({ preview: 0.05 * lv }),
    shadow: { name: 'Память отца', desc: 'Показа карт нет; первые 2 промаха бесплатны', mul: 0.2 } },
  { id: 'gaze', name: 'Милость Афины', steps: [{ cost: 20, desc: '«Взор Афины» держит карту открытой на 0,4 с дольше' }, { cost: 60, desc: 'Ещё на 0,4 с' }],
    fx: lv => ({ gazeLen: 0.4 * lv }),
    shadow: { name: 'Широкий взор', desc: 'Взор открывает три карты ряда, но на 0,5 с', mul: 0.1 } },
  { id: 'linger', name: 'Цепкая память', steps: [{ cost: 12, desc: 'После промаха карты видны на 0,1 с дольше' }, { cost: 30, desc: 'Ещё на 0,1 с' }, { cost: 70, desc: 'Ещё на 0,1 с' }],
    fx: lv => ({ linger: 0.1 * lv }),
    shadow: { name: 'Миг', desc: 'После промаха карты закрываются почти сразу', mul: 0.3 } },
  { id: 'flask', name: 'Глубокие фляги', steps: [{ cost: 40, desc: 'Первая фляга, найденная при 1–2 глотках, даёт +1 глоток' }],
    fx: lv => ({ flaskFirst: lv }),
    shadow: { name: 'Кровь предков', desc: 'Фляги −1; каждая вещь обряда — +1 глоток', mul: 0.1 } },
  { id: 'storm', name: 'Гроза ближе', steps: [{ cost: 50, desc: 'Гроза копится на 1 ход быстрее' }],
    fx: lv => ({ storm: lv }),
    shadow: { name: 'Гнев Зевса', desc: 'Гроза на 2 хода быстрее, но бьёт сама и коротко', mul: 0.15 } },
  { id: 'grace', name: 'Милость Деметры', steps: [{ cost: 50, desc: 'Каждый 14-й промах за поле прощается' }, { cost: 130, desc: 'Каждый 12-й промах прощается' }],
    fx: lv => ({ grace: [0, 14, 12][lv] || 0 }),
    shadow: { name: 'Строгая память', desc: 'Промах с картой, которую уже открывал, стоит 2 глотка', mul: 0.35 } },
];
export const stepsOf = u => u.steps.length;

// ---- Новые знамения (открываются за осколки в Хранилище; ключ unlocked 'o:id'). Параметры — как в OMENS (data.js), плюс:
// dear — каждый N-й промах стоит 2 глотка; pairs.laurel/horn — новые карты (лавр: пара даёт +3 ✦; горн: открыл — две карты меняются).
export const OMENS_NEW = [
  { id: 'echo', cost: 30, name: 'Эхо', plus: 'После промаха карты видны на 0,6 с дольше', minus: 'Показ карт короче на 0,6 с', mul: 1.1, linger: 0.6, preview: -0.6 },
  { id: 'bounty', cost: 40, name: 'Щедрая ночь', plus: '+1 пара амфор (4 глотка за пару)', minus: 'Показ карт короче на 0,8 с', mul: 0.9, pairs: { amphora: 1 }, preview: -0.8 },
  { id: 'dear', cost: 50, name: 'Дорогая ночь', plus: '+2 глотка', minus: 'Каждый 3-й промах стоит два глотка', mul: 1.2, water: 2, dear: 3 },
  { id: 'blind', cost: 60, name: 'Слепой ветер', plus: 'Гроза на 3 хода ближе', minus: 'Деймос сдвигает ряд каждые 5 ходов; показ короче на 0,8 с', mul: 1.7, storm: 3, pairs: { deimos: 1 }, quake: 5, preview: -0.8 },
  { id: 'feast', cost: 70, name: 'Вороний пир', plus: '+1 глоток', minus: 'Две пары воронов таскают вещи', mul: 1.4, water: 1, pairs: { raven: 2 } },
  { id: 'mirror', cost: 80, name: 'Зеркальная ночь', plus: '+1 глоток', minus: 'Каждый 2-й промах две карты меняются местами; показ короче на 0,6 с', mul: 1.5, water: 1, shuffle: 2, preview: -0.6 },
  { id: 'hand', cost: 90, name: 'Чужая рука', plus: '+1 «Взор Афины», +1 глоток', minus: '+2 пары чужих шлемов', mul: 1.5, gaze: 1, water: 1, pairs: { decoy: 2 } },
  { id: 'laurel', cost: 100, name: 'Лавровый венок', plus: '+1 глоток; каждая пара лавра даёт +3 ✦', minus: '+2 пары лавра: поле больше', mul: 1, water: 1, pairs: { laurel: 2 } },
  { id: 'horn', cost: 120, name: 'Горн тафийцев', plus: '+1 глоток', minus: 'Горн: открыл — через миг две карты меняются местами', mul: 1.4, water: 1, pairs: { horn: 1 } },
];

// ---- Реликвии забега: выбор 1 из 3 перед полями f3, f5, f7 (до 3 за забег), живут до конца прохода. У каждой плюс и цена.
// cost 0 — открыта с начала. Параметры — как у знамений; суммируются (числа), для частот N берётся самая частая.
export const RELICS = [
  { id: 'helm', cost: 0, name: 'Шлем Ареса', plus: '+1 «Взор Афины» в начале каждого поля', minus: 'Вороны на каждом поле', mul: 1.1, gaze: 1, pairs: { raven: 1 } },
  { id: 'flask', cost: 0, name: 'Бронзовая фляга', plus: 'Каждая фляга даёт +1 глоток', minus: 'Показ карт короче на 0,6 с', flask: 1, preview: -0.6 },
  { id: 'lyre', cost: 0, name: 'Лира Хиримаха', plus: 'После промаха карты видны на 0,4 с дольше', minus: 'Гроза копится на 1 ход медленнее', linger: 0.4, storm: -1 },
  { id: 'cloak', cost: 0, name: 'Плащ отца', plus: '+1 глоток в начале поля', minus: '+1 пара чужих шлемов', water: 1, pairs: { decoy: 1 } },
  { id: 'feather', cost: 60, name: 'Совиное перо', plus: 'Взор Афины держит карту на 1,5 с дольше', minus: 'Гроза копится на 2 хода медленнее', gazeLen: 1.5, storm: -2 },
  { id: 'arrow', cost: 80, name: 'Громовая стрела', plus: 'Гроза копится на 2 хода быстрее', minus: 'Деймос сдвигает ряд каждые 8 ходов', mul: 1.2, storm: 2, pairs: { deimos: 1 }, quake: 8 },
  { id: 'cup', cost: 100, name: 'Кубок Деметры', plus: '+2 глотка в начале поля', minus: 'Каждый 3-й промах стоит два глотка', water: 2, dear: 3 },
  { id: 'necklace', cost: 120, name: 'Ожерелье Алкмены', plus: 'Каждый 9-й промах за поле прощается', minus: 'Показ карт короче на 0,8 с', mul: 1.1, grace: 9, preview: -0.8 },
  { id: 'gshield', cost: 140, name: 'Щит Горгофона', plus: '+2 глотка в начале поля', minus: 'Пёс Ареса на каждом поле', mul: 1.15, water: 2, pairs: { hound: 1 } },
  { id: 'phobos', cost: 160, name: 'Зеркало Фобоса', plus: 'Осколки ×1,5', minus: 'Показ карт короче на 1,2 с', mul: 1.5, preview: -1.2 },
  { id: 'wreath', cost: 190, name: 'Лавр победы', plus: 'Осколки ×1,25', minus: '−1 глоток в начале поля', mul: 1.25, water: -1 },
  { id: 'skin', cost: 220, name: 'Мех Харона', plus: '+1 пара фляг на поле', minus: '+1 пара теней и +1 пара чужих шлемов', mul: 1.2, pairs: { flask: 1, shade: 1, decoy: 1 } },
];
export const RELIC_MAX = 3;
export const RELIC_FIELDS = ['f3', 'f5', 'f7'];

// ---- Рубашки карт в Хранилище (косметика, gfx.js BACKS). need — достижение, wrath — ступень Гнева.
export const BACKS_SHOP = [
  { id: 'ember', cost: 50, name: 'Рубашка «Угольная»', desc: 'Тлеющие угли и пепел' },
  { id: 'owl', cost: 80, name: 'Рубашка «Совиная»', desc: 'Два жёлтых глаза в ночи' },
  { id: 'wave', cost: 110, name: 'Рубашка «Морская»', desc: 'Волны Келенея' },
  { id: 'bone', cost: 140, name: 'Рубашка «Костяная»', desc: 'Скрещённые кости на сером' },
  { id: 'crow', cost: 170, name: 'Рубашка «Вороная»', desc: 'Перо ворона Ареса' },
  { id: 'ares', wrath: 3, name: 'Рубашка «Багровая»', desc: 'Награда: пройти игру на Гневе Ареса 2' },
  { id: 'iron', wrath: 6, name: 'Рубашка «Железная»', desc: 'Награда: пройти игру на Гневе Ареса 5' },
  { id: 'sun', wrath: 10, name: 'Рубашка «Солнечная»', desc: 'Награда: пройти игру на Гневе Ареса 9' },
];

// ---- Гнев Ареса: ступени 1…10 (накапливаются). Давление вместо силы. mods — как у знамений.
// Открывается проходом игры на текущей высшей ступени. Множитель осколков — WRATH_MUL[ступень].
export const WRATH_MAX = 10;
export const WRATH_MUL = [1, 1.1, 1.2, 1.3, 1.45, 1.6, 1.75, 1.9, 2.1, 2.3, 2.6];
export const WRATH = [null,
  { name: 'Короткий взгляд', rule: 'Показ карт короче на 0,3 с', mods: { preview: -0.3 } },
  { name: 'Дорогой промах', rule: 'Каждый 8-й промах стоит 2 глотка', mods: { dear: 8 } },
  { name: 'Ветер перемен', rule: 'Каждый 6-й промах две карты меняются местами', mods: { shuffle: 6 } },
  { name: 'Горький ветер', rule: 'Каждые 40 с — минус глоток', mods: { wind: 40 } },
  { name: 'Дымка', rule: 'В показе видно лишь 90 % карт', mods: { previewFrac: 0.9 } },
  { name: 'Дорогая ошибка', rule: 'Каждый 6-й промах стоит 2 глотка', mods: { dear: 6 } },
  { name: 'Буря перемен', rule: 'Каждый 4-й промах две карты меняются местами', mods: { shuffle: 4 } },
  { name: 'Густая дымка', rule: 'В показе видно лишь 80 % карт; гроза копится на 1 ход медленнее', mods: { previewFrac: 0.8, storm: -1 } },
  { name: 'Чужие лица', rule: '+1 пара чужих шлемов на поле', mods: { pairs: { decoy: 1 } } },
  { name: 'Взгляд Ареса', rule: 'Деймос сдвигает ряд каждые 8 ходов; каждый 4-й промах стоит 2 глотка; минус глоток каждые 30 с', mods: { pairs: { deimos: 1 }, quake: 8, dear: 4, wind: 30 }, skipF1: true },
];
// суммарные модификаторы ступени (накопление 1…tier); def — поле (decoy/shade только у полей сыновей; Деймос ступени 10 — не на f1)
export function wrathMods(tier, def) {
  const out = {};
  for (let t = 1; t <= Math.min(WRATH_MAX, tier | 0); t++) {
    const w = WRATH[t]; if (!w) continue;
    let m = w.mods;
    if (w.skipF1 && def?.id === 'f1') { m = { ...m, pairs: { ...m.pairs } }; delete m.quake; delete m.pairs.deimos; }
    mergeMods(out, m, def);
  }
  return out;
}

// слияние модификаторов: числа складываются, pairs суммируются, частоты (N) — самая частая, флаги — ИЛИ
const FREQ = ['quake', 'shuffle', 'wind', 'grace', 'dear'], MIN_FRAC = ['previewFrac'];
export function mergeMods(out, m, def) {
  if (!m) return out;
  for (const [k, v] of Object.entries(m)) {
    if (k === 'pairs') { out.pairs ||= {}; for (const [t, n] of Object.entries(v)) { if ((t === 'decoy' || t === 'shade') && def && def.son == null) continue; out.pairs[t] = (out.pairs[t] || 0) + n; } }
    else if (k === 'mul') out.mul = (out.mul ?? 1) * v;
    else if (FREQ.includes(k)) { if (v) out[k] = out[k] ? Math.min(out[k], v) : v; }
    else if (MIN_FRAC.includes(k)) out[k] = Math.min(out[k] ?? 1, v);
    else if (typeof v === 'boolean') out[k] = out[k] || v;
    else out[k] = (out[k] || 0) + v;
  }
  return out;
}

// ---- Хранилище: единый список открытий. key — в save.unlocked; cost — осколки; need — достижение; wrath — ступень Гнева.
export const COLLECTION = [
  ...OMENS_NEW.map(o => ({ kind: 'omen', key: 'o:' + o.id, id: o.id, name: o.name, cost: o.cost, plus: o.plus, minus: o.minus, mul: o.mul })),
  ...RELICS.map(r => ({ kind: 'relic', key: 'r:' + r.id, id: r.id, name: r.name, cost: r.cost, plus: r.plus, minus: r.minus, mul: r.mul })),
  ...BACKS_SHOP.map(b => ({ kind: 'back', key: 'b:' + b.id, id: b.id, name: b.name, cost: b.cost ?? null, wrath: b.wrath, desc: b.desc })),
];
export const KIND_NAME = { omen: 'знамение', relic: 'реликвия', back: 'рубашка' };
export function isOwned(save, it) {
  if (it.cost === 0) return true;
  if (it.wrath) return (save.wrath?.max || 0) >= it.wrath;   // награда ступени Гнева (открыта ступень it.wrath = пройдена предыдущая)
  return !!save.unlocked?.[it.key];
}
export const ownedSet = save => new Set(COLLECTION.filter(it => isOwned(save, it)).map(it => it.key));
export const relicOf = id => RELICS.find(r => r.id === id) || null;
export const omenNewOf = id => OMENS_NEW.find(o => o.id === id) || null;
// знамение доступно в выборе: открыто в Хранилище (новые) или получено достижением (need) — решает meta.js
export const omenUnlocked = (save, id) => !OMENS_NEW.some(o => o.id === id) || !!save.unlocked?.['o:' + id];

// ---- цена ступени алтаря, суммарные числа
export function upCost(save, u) { const lv = save.up?.[u.id] || 0; return lv >= u.steps.length ? null : u.steps[lv].cost; }
export const ladderTotal = () => UPGRADES.reduce((a, u) => a + u.steps.reduce((s, st) => s + st.cost, 0), 0);
export const shopTotal = () => COLLECTION.reduce((a, it) => a + (it.cost || 0), 0);

// ---- ближайшая цель для экрана смерти: самое дешёвое из ещё не открытого (ступень алтаря или предмет Хранилища)
export function nextGoal(save) {
  let best = null;
  const take = (name, cost, where) => { if (cost != null && cost > 0 && (!best || cost < best.cost)) best = { name, cost, where }; };
  for (const u of UPGRADES) take(u.name, upCost(save, u), 'altar');
  for (const it of COLLECTION) if (!isOwned(save, it) && it.cost) take(it.name, it.cost, 'vault');
  return best;
}

// ---- миграция сохранения к v4: все покупки итерации 3 возвращаются осколками (цены тех лет), алтарь начинается заново
const OLD_COST = { water: [14, 34], preview: [12], gaze: [24], linger: [16], flask: [18], storm: [16] };
export function migrateV4(save) {
  if (save.metaV >= 4) return false;
  let back = 0; for (const [id, costs] of Object.entries(OLD_COST)) { const lv = save.up?.[id] || 0; for (let k = 0; k < Math.min(lv, costs.length); k++) back += costs[k]; }
  save.shards = (save.shards || 0) + back; save.up = {}; save.side = {};
  save.unlocked ||= {}; save.wrath ||= { max: 0, sel: 0 }; save.run ||= { wrath: 0, relics: [], drafted: {}, fails: {} };
  if (save.finished && !save.wrath.max) save.wrath.max = 1;   // кто уже прошёл игру — Гнев 1 открыт
  save.metaV = 4; save.refund = back;   // refund — для сообщения в Алтаре («возвращено N ✦»)
  return true;
}
