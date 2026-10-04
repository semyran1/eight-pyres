// Смерть как отдельный кадр-комикс (без доски под ним) и «Алтарь памяти» — улучшения за осколки памяти.
// Задача — чтобы смерть не раздражала: каждая попытка что-то даёт, и это видно сразу.
import { OMENS, FIELDS, SONS, CAMPAIGN, ACHIEVEMENTS } from './data.js';
import { UPGRADES, OMENS_NEW, RELICS, RELIC_MAX, RELIC_FIELDS, WRATH, WRATH_MAX, WRATH_MUL, COLLECTION, KIND_NAME, wrathMods, mergeMods, isOwned, relicOf, upCost, nextGoal, migrateV4, ladderTotal, shopTotal } from './progress.js';
import { img, W, H, text, wrap, button, comicBox, drawCam, drawPost, Fog, STYLE, COS, drawBadge, cardBack } from '../art/gfx.js';
import { pxIcon, pxPanel, pxFrame, PAL } from '../art/pixel.js';
import { sfx, setAmbient } from '../engine/audio.js';
import { setMood } from '../engine/score.js';
import { starIcon } from './ui.js';

export { upCost };
export const ALL_OMENS = [...OMENS, ...OMENS_NEW];
export const omenOf = save => ALL_OMENS.find(o => o.id === save.omen?.id) || null;

// сохранение → v4: покупки итерации 3 возвращаются осколками (progress.js migrateV4), заводятся unlocked/wrath/run
export function migrate(save) {
  migrateV4(save);
  save.up ||= {}; save.side ||= {}; save.unlocked ||= {}; save.wrath ||= { max: 0, sel: 0 }; save.run ||= { wrath: 0, relics: [], drafted: {}, fails: {} };
  save.run.relics ||= []; save.run.drafted ||= {}; save.run.fails ||= {};
  for (const u of UPGRADES) if ((save.up[u.id] || 0) > u.steps.length) save.up[u.id] = u.steps.length;
}
const isShadow = (save, id) => save.side?.[id] === 'shadow' && (save.up?.[id] || 0) > 0;
export function shadowMul(save) { return UPGRADES.reduce((a, u) => a + (isShadow(save, u.id) ? u.shadow.mul : 0), 0); }
// «забег» — один проход кампании: Гнев, реликвии, милость отца после неудач; новая игра обнуляет, алтарь и Хранилище — нет
export function newRun(save) { migrate(save); save.run = { wrath: Math.min(save.wrath.sel || 0, save.wrath.max || 0), relics: [], drafted: {}, fails: {} }; save.omen = null; }
// конец прохода: пройдена высшая открытая ступень — открывается следующая; возвращает новую ступень или 0
export function finishRun(save) {
  migrate(save); const w = save.run.wrath || 0;
  if (w >= (save.wrath.max || 0) && save.wrath.max < WRATH_MAX) { save.wrath.max = Math.max(1, w + 1); save.wrath.sel = save.wrath.max; return save.wrath.max; }
  return 0;
}
export const noteFail = (save, id) => { migrate(save); save.run.fails[id] = (save.run.fails[id] || 0) + 1; };
export const clearFail = (save, id) => { if (save.run?.fails) delete save.run.fails[id]; };
// «упрямство отца»: после двух смертей на поле — +1 глоток, после четырёх — +2; победа сбрасывает
const pityOf = (save, id) => { const n = save.run?.fails?.[id] || 0; return n >= 4 ? 2 : n >= 2 ? 1 : 0; };
export const relicPool = save => RELICS.filter(r => (r.cost === 0 || save.unlocked?.['r:' + r.id]) && !(save.run?.relics || []).includes(r.id));
export const wrathMul = tier => WRATH_MUL[Math.min(WRATH_MAX, tier | 0)] || 1;

// Все модификаторы поля — одним объектом; field.js читает только его. Источники: ступени алтаря (свет/тень), знамение поля,
// реликвии забега, Гнев Ареса, упрямство отца. Числа складываются, частоты (N) — самая частая; осколки — множитель.
const PARAMS = ['water', 'preview', 'gaze', 'linger', 'flask', 'storm', 'gazeLen', 'cap', 'flaskFirst', 'waterShards', 'pairs', 'mul', 'quake', 'wind', 'shuffle', 'grace', 'dear', 'previewFrac', 'noPreview'];
const only = o => { const r = {}; if (o) for (const k of PARAMS) if (o[k] != null) r[k] = o[k]; return r; };
export function runMods(save, fieldId) {
  migrate(save);
  const def = { id: fieldId, ...(FIELDS[fieldId] || {}) }, up = save.up, Sh = id => isShadow(save, id);
  const om = save.omen && save.omen.field === fieldId ? omenOf(save) : null;
  const rel = (save.run?.relics || []).map(relicOf).filter(Boolean), tier = save.run?.wrath || 0;
  const M = {};
  for (const u of UPGRADES) if (!Sh(u.id)) mergeMods(M, u.fx(up[u.id] || 0), def);
  mergeMods(M, only(om), def); for (const r of rel) mergeMods(M, only(r), def); mergeMods(M, wrathMods(tier, def), def);
  const pity = pityOf(save, fieldId), stormOm = mergeMods({}, only(om), def).storm || 0;
  return {
    water: (M.water || 0) - (Sh('water') ? 1 : 0) + pity, streakWater: Sh('water'), pity,
    preview: (M.preview || 0), noPreview: Sh('preview') || !!M.noPreview, freeMiss: Sh('preview') ? 2 : 0, previewFrac: M.previewFrac ?? 1,
    gaze: M.gaze || 0, gazeWide: Sh('gaze'), gazeLen: M.gazeLen || 0,
    linger: M.linger || 0, fastClose: Sh('linger'),
    flask: (M.flask || 0) - (Sh('flask') ? 1 : 0), ritualWater: Sh('flask'), flaskFirst: M.flaskFirst || 0, cap: M.cap || 0, waterShards: M.waterShards || 0,
    storm: stormOm + (Sh('storm') ? 2 : 0), stormUp: (M.storm || 0) - stormOm, stormAuto: Sh('storm'),   // storm — знамение/тень (может создать грозу на поле без неё); stormUp — ступень, реликвии, Гнев (только ускоряют/замедляют уже бывшую)
    grace: M.grace || 0, strict: Sh('grace'), dear: M.dear || 0,
    pairs: M.pairs || {}, quake: M.quake || 0, wind: M.wind || 0, shuffle: M.shuffle || 0,
    shardMul: (1 + shadowMul(save)) * (M.mul ?? 1) * wrathMul(tier), omen: om, relics: rel.map(r => r.id), wrath: tier,
  };
}
// знамение спрашивается перед полем сына, кроме первого (f1 учит обряду), если на это поле ещё не выбрано
export const needsOmen = (save, id) => FIELDS[id]?.son != null && id !== 'f1' && save.omen?.field !== id;
// реликвия — 1 из 3 перед f3, f5, f7 (до трёх за забег), если есть из чего выбирать
export const needsRelic = (save, id) => { migrate(save); return RELIC_FIELDS.includes(id) && !save.run.drafted[id] && save.run.relics.length < RELIC_MAX && relicPool(save).length > 0; };
const pct = v => (v >= 0 ? '+' : '−') + Math.round(Math.abs(v) * 100) + ' %';

// ---- награды достижений (data.js ACHIEVEMENTS.reward): применяются один раз при получении
export function applyReward(save, a) {
  const r = a?.reward; if (!r) return;
  save.cos ||= {};
  if (r.kind === 'back' && !save.cos.back) save.cos.back = r.id;   // первая рубашка надевается сама, дальше — выбор в «Достижениях»
  if (r.kind === 'gift') { save.gifts ||= {}; save.gifts[r.id] = (save.gifts[r.id] || 0) + 1; }
  syncCos(save);
}
// косметика из сохранения → gfx (рубашка, звёзды созвездия)
export function syncCos(save) {
  COS.back = save.cos?.back || null;
  COS.stars = ACHIEVEMENTS.filter(a => save.ach?.[a.id] && a.reward?.kind === 'star').map(a => a.reward.id);
}
// воспоминания отца, открытые достижениями
const memories = save => ACHIEVEMENTS.filter(a => save.ach?.[a.id] && a.reward?.kind === 'memory').map(a => a.reward.text);

// ---- Экран смерти «вау»: реплика Харона по причине смерти (без повторов), осколки летят в копилку,
// полоска до следующего места на алтаре, кто из сыновей ждёт. Всё анимированное пропускается кликом/пробелом.
const CHARON = {
  first: ['Харон улыбается, приветствуя ещё одного падшего монарха… Рано, старик. Твои сыновья ещё ждут.'],
  close: ['Ещё пара шагов — и ты бы успел. Вода кончилась раньше памяти.', 'Так близко… Лодка подождёт. Сын — нет.', 'Ты почти собрал его. Почти — это ещё не костёр, старик.'],
  ravens: ['Вороны растащили твою память по полю. Гони их раньше.', 'Птицы Ареса сыты. А ты всё ещё жаждешь.'],
  hound: ['Пёс Ареса кусает тех, кто медлит. Ты медлил.', 'Пёс сыт твоей водой. Не открывай его наугад.'],
  fear: ['Страх путает карты, Ужас сдвигает их. Верь памяти, а не им.', 'Сыновья Ареса смеются. Посмей вернуться.'],
  omen: ['Ты сам выбрал эту ночь. Смелый выбор — дорогая цена.'],
  again: ['Опять ты. Я уже узнаю твои шаги, старик.', 'Снова на берегу? Вёсла устали ждать.'],
  early: ['Так скоро? Ты и поля-то не разглядел.', 'Не спеши ко мне. Сначала смотри, потом открывай.'],
  any: ['Монету за переправу оставь себе. Ты ещё не мой.', 'Жажда — не смерть. Смерть — забыть их лица.', 'Вода кончилась, а память — нет. Возьми её с собой.', 'Стикс не для тебя. Пока.'],
};
function pickCharon(save, info) {
  const s = info.snap || {}, left = s.total ? s.left / s.total : 0.5, f = FIELDS[info.id] || {};
  const cats = [];
  if ((save.stats?.deaths || 0) <= 1) cats.push('first');
  if (s.total && (s.left <= 4 || left <= 0.25)) cats.push('close');
  if (s.ravens > 0) cats.push('ravens');
  if (s.bitten > 0) cats.push('hound');
  if (s.phobos || f.deimos) cats.push('fear');
  if (s.omen && (ALL_OMENS.find(o => o.id === s.omen)?.mul || 1) >= 1.4) cats.push('omen');
  if ((info.tries || 1) >= 3) cats.push('again');
  if (s.total && left >= 0.7) cats.push('early');
  cats.push('any');
  const seen = save.charonSeen ||= [];
  const all = cats.flatMap(c => CHARON[c].map((l, i) => c + i));
  let key = all.find(k => !seen.includes(k)) || CHARON.any.map((l, i) => 'any' + i).find(k => !seen.includes(k));
  if (!key) { seen.length = 0; key = all[0]; }
  seen.push(key); if (seen.length > 14) seen.shift();
  const c = key.replace(/\d+$/, ''); return { key, text: CHARON[c][+key.slice(c.length)] };
}
// сын, который ждёт: сын этого поля или первый ещё не проводивший
function waitingSon(save, info) {
  if (info.son) return info.son;
  if (info.id === 'names') return 'names';
  const st = CAMPAIGN.find(s => s.t === 'field' && FIELDS[s.id]?.son != null && !save.best?.[s.id]);
  return st && (CAMPAIGN.indexOf(st) <= (save.maxStep || 0)) ? SONS[FIELDS[st.id].son] : null;
}
// ближайшая цель: самое дешёвое из ещё не открытого — ступень алтаря или предмет Хранилища (progress.js nextGoal)
const nextUnlock = nextGoal;
function shardGem(ctx, x, y, r, glow = 0) {
  if (STYLE.pixel) { pxIcon(ctx, 'shard', x, y, r > 8 ? 4 : 2, { w: glow > 0.3 ? '#ffffff' : '#fff0c8', e: '#ffb040' }); return; }
  ctx.save(); if (glow > 0) { ctx.shadowColor = 'rgba(255,196,110,0.95)'; ctx.shadowBlur = 6 + glow * 16; }
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.62, y - r * 0.12); ctx.lineTo(x + r * 0.2, y + r); ctx.lineTo(x - r * 0.56, y + r * 0.34); ctx.lineTo(x - r * 0.46, y - r * 0.46); ctx.closePath();
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, '#fff6dc'); g.addColorStop(0.55, '#f2c27a'); g.addColorStop(1, '#a8622a');
  ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(90,50,20,0.9)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x - r * 0.05, y + r * 0.2); ctx.lineTo(x + r * 0.2, y + r); ctx.moveTo(x - r * 0.05, y + r * 0.2); ctx.lineTo(x - r * 0.56, y + r * 0.34); ctx.strokeStyle = 'rgba(255,250,235,0.55)'; ctx.stroke();
  ctx.restore();
}
const DJAR = [708, 170];   // куда летят осколки (значок «всего»)

export function createDeath(app) {
  let D = null; const fog = new Fog(); fog.amount = 0.5;
  const ease = k => 1 - (1 - k) ** 3;
  return {
    enter(game, info) {
      const save = app.save, n = Math.max(0, info.shards || 0), total = save.shards || 0;
      const m = n ? Math.min(14, 3 + Math.ceil(n / 2)) : 0;
      const fly = Array.from({ length: m }, (_, k) => ({ t0: 0.85 + k * 0.075, x0: 250 + Math.random() * 260, y0: 330 + Math.random() * 60, arc: 60 + Math.random() * 70, done: false }));
      const ch = pickCharon(save, info), mem = memories(save);
      D = { ...info, t: 0, n, total, total0: total - n, fly, got: 0, pulse: 0, ch, son: waitingSon(save, info),
        mem: mem.length ? mem[Math.floor(Math.random() * mem.length)] : null, next: nextUnlock(save), rung: false };
      D.end = (m ? fly[m - 1].t0 + 0.55 : 0.9) + 0.7;   // конец анимации (дальше — пропускать нечего)
      app.persist();
      setMood('styx'); setAmbient({ rain: 0, night: 0.2, fire: 0, wind: 0.3 }); sfx('sacred', { vol: 0.25, rate: 0.7 });
    },
    update(dt) { if (D) { D.t += dt; D.pulse = Math.max(0, D.pulse - dt * 3); fog.update(dt); } app.inp.endStep(); },
    skip() { if (D && D.t < D.end) D.t = D.end; },   // для тестов
    toText: () => ({ scene: 'death', id: D?.id, line: D?.ch.key, shards: D?.n, total: D?.total, shown: D ? D.total0 + D.got : 0,
      done: !!D && D.t >= D.end, next: D?.next ? { name: D.next.name, where: D.next.where, cost: D.next.cost } : null, son: D?.son?.name || D?.son || null, mem: !!D?.mem }),
    draw(ctx) {
      if (!D) return;
      const inp = app.inp, P = inp.pointer, px = STYLE.pixel;
      ctx.fillStyle = '#050203'; ctx.fillRect(0, 0, W, H);
      // один кадр: Харон на Стиксе, медленный наезд, кинорамка
      const im = img('c_styx'); if (im) { ctx.globalAlpha = Math.min(1, D.t * 0.8); drawCam(ctx, im, [0.42, 0.5, 1.15 + D.t * 0.01]); ctx.globalAlpha = 1; }
      fog.draw(ctx, 300);
      ctx.fillStyle = '#050203'; ctx.fillRect(0, 0, W, 34); ctx.fillRect(0, H - 34, W, 34);
      const a = Math.min(1, Math.max(0, D.t - 0.3) * 2.5);
      ctx.globalAlpha = a;
      // реплика Харона (+ воспоминание отца в ответ, если открыто достижением)
      const cl = wrap(ctx, D.ch.text, 452, 19), ml = D.mem ? wrap(ctx, '— ' + D.mem, 440, 16) : [];
      const bh = 44 + cl.length * 24 + (ml.length ? 10 + ml.length * 21 : 0) + 6;
      comicBox(ctx, 40, 50, 500, bh);
      text(ctx, 'Харон', 66, 72, { size: 16, sc: true, align: 'left', color: '#b9c9b3', spacing: 2 });
      cl.forEach((l, i) => text(ctx, l, 66, 98 + i * 24, { size: 19, align: 'left' }));
      ml.forEach((l, i) => text(ctx, l, 74, 98 + cl.length * 24 + 8 + i * 21, { size: 16, align: 'left', color: '#d9c09a' }));
      // кто ждёт
      let sy = 50 + bh + 30;
      if (D.son === 'names') text(ctx, 'Восемь теней ждут на берегу своих имён.', 44, sy, { size: 18, align: 'left', color: '#e8d2b8' });
      else if (D.son) { drawBadge(ctx, D.son, 62, sy, 17); text(ctx, `${D.son.name} ещё ждёт свой костёр.`, 90, sy, { size: 18, align: 'left', color: '#e8d2b8' }); }
      if (D.snap?.total) text(ctx, `Пар найдено: ${(D.snap.total - D.snap.left) / 2} из ${D.snap.total / 2}` + ((D.tries || 1) > 1 ? ` · попытка ${D.tries}` : ''), D.son ? 90 : 44, sy + 26, { size: 16, align: 'left', color: '#c4ae98' });
      // осколки: +N считается по мере прилёта, копилка вспыхивает
      comicBox(ctx, 600, 50, 320, 232);
      text(ctx, 'Осколки памяти', 760, 74, { size: 17, sc: true, color: '#ffe0a8', spacing: 1 });
      for (const f of D.fly) {
        const k = (D.t - f.t0) / 0.55; if (k < 0) continue;
        if (k >= 1) { if (!f.done) { f.done = true; D.got = Math.round(D.n * D.fly.filter(q => q.done).length / D.fly.length); D.pulse = 1; if (D.t - f.t0 < 0.75) sfx('coin', { vol: 0.22, rate: 0.9 + 0.5 * D.got / Math.max(1, D.n), gap: 0.02 }); } continue; }
        const e = ease(k), x = f.x0 + (DJAR[0] - f.x0) * e, y = f.y0 + (DJAR[1] - f.y0) * e - Math.sin(Math.PI * k) * f.arc;
        shardGem(ctx, x, y, px ? 6 : 10 - 4 * k, 0.6);
        if (!px) { ctx.save(); ctx.globalAlpha = a * 0.35 * (1 - k); ctx.fillStyle = '#ffcf7a'; ctx.beginPath(); ctx.arc(f.x0 + (DJAR[0] - f.x0) * ease(Math.max(0, k - 0.08)), f.y0 + (DJAR[1] - f.y0) * ease(Math.max(0, k - 0.08)) - Math.sin(Math.PI * Math.max(0, k - 0.08)) * f.arc, 3, 0, 6.3); ctx.fill(); ctx.restore(); }
      }
      if (D.t >= D.end) D.got = D.n;
      const pop = 1 + D.pulse * 0.12;
      ctx.save(); ctx.translate(760, 124); ctx.scale(pop, pop);
      if (D.n) text(ctx, '+' + D.got, 0, 0, { size: 44, sc: true, color: '#fff0d0' }); else text(ctx, 'Осколки дают найденные пары', 0, 0, { size: 16, color: '#c4ae98' }); ctx.restore();
      shardGem(ctx, DJAR[0], DJAR[1], 11, D.pulse);
      text(ctx, 'всего: ' + (D.total0 + D.got), DJAR[0] + 20, DJAR[1] + 1, { size: 20, align: 'left', color: '#ead9c6' });
      // полоска до следующего места на алтаре: наполняется после счёта
      const nx = D.next;
      if (nx) {
        const k = ease(Math.min(1, Math.max(0, (D.t - (D.end - 0.7)) / 0.6))), v = D.total0 + D.n * k, fr = Math.min(1, v / nx.cost), ready = D.total >= nx.cost;
        const bx = 624, by = 200, bw = 272, bh2 = 14;
        if (px) { pxPanel(ctx, bx - 4, by - 4, bw + 8, bh2 + 8, { frame: ready && k >= 1 ? PAL.gold : '#a06e46' }); ctx.fillStyle = ready ? PAL.gold : PAL.orange; ctx.fillRect(bx, by, Math.round(bw * fr / 4) * 4, bh2 - 2); }
        else {
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by, bw, bh2);
          const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#8a4a1c'); g.addColorStop(1, ready ? '#ffe08a' : '#e0a050');
          ctx.save(); if (ready && k >= 1) { ctx.shadowColor = 'rgba(255,200,110,0.9)'; ctx.shadowBlur = 10 + 4 * Math.sin(D.t * 5); } ctx.fillStyle = g; ctx.fillRect(bx, by, bw * fr, bh2); ctx.restore();
          ctx.strokeStyle = '#a8582c'; ctx.lineWidth = 1.5; ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, bh2 + 1);
        }
        if (ready && k >= 1 && !D.rung) { D.rung = true; sfx('bells', { vol: 0.3 }); }
        const lbl = ready && k >= 1 ? `Хватает на «${nx.name}» — загляни ${nx.where === 'vault' ? 'в Хранилище' : 'на алтарь'}` : `До открытия «${nx.name}» осталось ${Math.max(0, Math.ceil(nx.cost - v))} ✦`;
        wrap(ctx, lbl, 284, 16).slice(0, 2).forEach((l, i) => text(ctx, l, 760, 236 + i * 20, { size: 16, color: ready && k >= 1 ? '#ffe08a' : '#cdb6a0' }));
      } else if (!nx) text(ctx, 'Всё открыто. Дальше — Гнев Ареса', 760, 236, { size: 16, color: '#8fdc7a' });
      ctx.globalAlpha = 1;
      // кнопки: «Встать снова» — главная и крупная, сразу; алтарь и меню — мелкие
      if (D.t > 0.45) {
        const ready = D.next && D.total >= D.next.cost && D.t >= D.end;
        if (button(ctx, inp, 40, 418, 320, 66, 'Встать снова', { key: 'Enter', size: 26, primary: true })) { app.retryField(D); return; }
        // хватает на покупку — алтарь «зовёт»: кнопка тлеет
        if (button(ctx, inp, 380, 430, 200, 44, ready ? 'Алтарь памяти ✦' : 'Алтарь памяти', { size: 16, glow: ready })) { app.altar(() => app.retryField(D), D.next?.where === 'vault' && ready ? 'vault' : 'altar'); return; }
        if (button(ctx, inp, 592, 430, 116, 44, 'Меню', { size: 16 })) { app.goMenu(); return; }
      }
      // клик мимо кнопок или пробел — досмотреть сразу
      if (D.t < D.end && ((P.clicked && D.t > 0.2) || inp.uiHit('Space'))) { P.clicked = false; D.t = D.end; }
      if (D.t < D.end) text(ctx, 'клик — пропустить', 916, 452, { size: 16, align: 'right', color: '#a99382' });
      drawPost(ctx, { tint: '#3a4a40', tintA: 0.12 });
    },
  };
}

// ---- Хранилище: список открытий (осколки / достижение / ступень Гнева), эмблемы-силуэты
const GLYPHS = ['eye', 'horns', 'wave', 'sun', 'snake', 'moon', 'star', 'arrow'];
const CRESTS = ['#c8102e', '#efe6d2', '#2f6db5', '#e0a526', '#3f9a52', '#7e3fa0', '#b8632f', '#c9ced6'];
const KIND_COL = { omen: '#c9b4e8', relic: '#ffcf7a', back: '#e09060' };
const hash = str => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) >>> 0;
export function vaultList(save) {
  const list = COLLECTION.filter(it => it.cost !== 0);
  for (const a of ACHIEVEMENTS) if (a.reward?.kind === 'omen' || a.reward?.kind === 'back') list.push({ kind: a.reward.kind, key: 'a:' + a.id, id: a.reward.id, name: a.reward.name, need: a.id, desc: a.reward.desc, ach: a.name });
  const ko = { omen: 0, relic: 1, back: 2 }, rank = it => it.cost ? 0 : it.wrath ? 2 : 1;
  return list.sort((x, y) => ko[x.kind] - ko[y.kind] || rank(x) - rank(y) || (x.cost || x.wrath || 0) - (y.cost || y.wrath || 0));
}
export const vaultOwned = (save, it) => it.need ? !!save.ach?.[it.need] : isOwned(save, it);
function lockIcon(ctx, x, y, r) {
  if (STYLE.pixel) return pxIcon(ctx, 'lock', x, y, r > 8 ? 4 : 2);
  ctx.save(); ctx.fillStyle = '#c9b8a8'; ctx.fillRect(x - r, y - r * 0.2, r * 2, r * 1.5); ctx.strokeStyle = '#c9b8a8'; ctx.lineWidth = r * 0.35; ctx.beginPath(); ctx.arc(x, y - r * 0.2, r * 0.65, Math.PI, 0); ctx.stroke(); ctx.restore();
}
function emblem(ctx, it, x, y, r, own) {
  if (it.kind === 'back') {   // рубашка: миниатюра карты
    const im = cardBack(it.id); if (!im) return;
    const h = r * 2.2, w = h * im.width / im.height; ctx.save(); ctx.imageSmoothingEnabled = !STYLE.pixel; ctx.globalAlpha = own ? 1 : 0.4; ctx.drawImage(im, x - w / 2, y - h / 2, w, h); ctx.restore();
    if (!own) lockIcon(ctx, x, y, 7); return;
  }
  const h = hash(it.key), g = GLYPHS[h % 8], c = CRESTS[(h >> 3) % 8];
  ctx.save(); ctx.globalAlpha = own ? 1 : 0.45; drawBadge(ctx, own ? { crest: c, crest2: c, glyph: g } : { crest: '#4a3e44', crest2: '#4a3e44', glyph: g }, x, y, r); ctx.restore();
  if (!own) lockIcon(ctx, x, y + r * 0.1, 7);
}

export function createAltar(app) {
  let back = null, t = 0, flashId = null, flashT = 0, tab = 'altar', page = 0, hovDetail = null, showRefund = 0;
  const TABS = [['altar', 'Алтарь'], ['vault', 'Хранилище'], ['run', 'Забег']];
  const save = () => app.save;
  const pickable = () => (save().step || 0) === 0;   // ступень Гнева выбирается при начале нового прохода
  function buy(it) {
    const sv = save(); if ((sv.shards || 0) < it.cost || vaultOwned(sv, it)) return;
    sv.shards -= it.cost; sv.unlocked[it.key] = 1;
    if (it.kind === 'back' && !(sv.cos?.back)) app.setBack(it.id);   // первая купленная рубашка надевается сама
    app.persist(); sfx('bells', { vol: 0.45 }); flashId = it.key; flashT = 0.6;
  }
  const exit = () => { const sv = save(); if (sv.refund && !sv.refundShown) { sv.refundShown = 1; app.persist(); } const b = back; back = null; b ? b() : app.goMenu(); };
  return {
    enter(game, o = {}) { back = o.onBack || null; t = 0; tab = o.tab || 'altar'; page = 0; setMood('memory'); migrate(save()); showRefund = save().refund && !save().refundShown ? 1 : 0; app.persist(); },
    update(dt) { t += dt; flashT = Math.max(0, flashT - dt); app.inp.endStep(); },
    toText: () => ({ scene: 'altar', shards: save().shards, tab, page, own: COLLECTION.filter(it => isOwned(save(), it)).length, wrath: { max: save().wrath?.max, sel: save().wrath?.sel }, run: save().run }),
    setTab(x, p = 0) { tab = x; page = p; },
    draw(ctx) {
      const inp = app.inp, P = inp.pointer, px = STYLE.pixel;
      ctx.fillStyle = '#070405'; ctx.fillRect(0, 0, W, H);
      const im = img('c_pyre'); if (im) { ctx.globalAlpha = 0.5; drawCam(ctx, im, [0.5, 0.6, 1.1]); ctx.globalAlpha = 1; }
      if (px) { ctx.fillStyle = 'rgba(7,4,5,0.6)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = 'rgba(7,4,5,0.5)'; ctx.fillRect(0, 300, W, H - 300); }   // ступени вместо плавного градиента
      else { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(7,4,5,0.6)'); g.addColorStop(1, 'rgba(7,4,5,0.9)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      text(ctx, 'Алтарь памяти', W / 2, 30, { size: 30, sc: true, spacing: 3 });
      // вкладки; активная — золотая рамка
      TABS.forEach(([id, name], i) => {
        const x = 215 + i * 180, y = 48;
        if (button(ctx, inp, x, y, 170, 34, name, { size: 17 })) { tab = id; page = 0; sfx('flip', { vol: 0.4 }); }
        if (tab === id) { ctx.save(); ctx.strokeStyle = '#ffcf7a'; ctx.lineWidth = 2; if (px) pxFrame(ctx, x - 3, y - 3, 176, 40, '#ffcf7a'); else ctx.strokeRect(x - 2, y - 2, 174, 38); ctx.restore(); }
      });
      // полоса: осколки — навсегда; забег — на этот проход
      const sv = save(), run = sv.run || {}, sm = shadowMul(sv);
      text(ctx, 'Осколков: ' + (sv.shards || 0) + (sm > 0 ? ` · тень: осколки ${pct(sm)}` : ''), 30, 104, { size: 18, align: 'left', color: '#ffe0a8', sc: true });
      text(ctx, `Этот забег: Гнев Ареса ${run.wrath || 0} · реликвии ${run.relics?.length || 0}/${RELIC_MAX}`, 930, 104, { size: 16, align: 'right', color: '#cdb6a0' });
      hovDetail = null;
      if (tab === 'altar') drawLadder(ctx, inp, P);
      else if (tab === 'vault') drawVault(ctx, inp, P);
      else drawRun(ctx, inp, P);
      if (button(ctx, inp, W / 2 - 110, H - 50, 220, 40, back ? 'Дальше' : 'Назад', { size: 18, key: 'Escape' })) exit();
      drawPost(ctx, { tint: '#6b3a48', tintA: 0.12 });
    },
  };
  // ---- вкладка «Алтарь»: 7 мест, ступени облегчения (сила с потолком) и тень (другое правило, больше осколков)
  function drawLadder(ctx, inp, P) {
    const sv = save();
    if (showRefund) text(ctx, `Покупки прошлой версии возвращены: +${sv.refund} ✦ — алтарь теперь шире`, W / 2, 120, { size: 15, color: '#a8e08e' });
    UPGRADES.forEach((u, i) => {
      const col = i % 2, row = i >> 1, x = 30 + col * 450, y = 128 + row * 86, lv = sv.up?.[u.id] || 0, cost = upCost(sv, u), n = u.steps.length;
      const sh = sv.side?.[u.id] === 'shadow' && lv > 0;
      comicBox(ctx, x, y, 430, 82, flashId === u.id && flashT > 0 ? 1 : 0.85);
      if (sh) { ctx.fillStyle = 'rgba(60,30,80,0.35)'; ctx.fillRect(x + 4, y + 4, 422, 74); }
      const name = sh ? u.shadow.name : u.name, desc = sh ? u.shadow.desc : (cost == null ? u.steps[n - 1].desc : u.steps[lv].desc);
      text(ctx, name, x + 16, y + 21, { size: 19, sc: true, align: 'left', color: sh ? '#d8c4f0' : '#efdcc4' });
      wrap(ctx, desc, 270, 14).slice(0, 2).forEach((l, k) => text(ctx, l, x + 16, y + 38 + k * 14, { size: 14, align: 'left', color: sh || cost != null ? '#cdb6a0' : '#8d7a6d' }));
      ctx.save(); if (sh) ctx.globalAlpha = 0.4; for (let k = 0; k < n; k++) starIcon(ctx, x + 24 + k * 22, y + 70, 8, k < lv); ctx.restore();
      text(ctx, sh ? `тень · осколки ${pct(u.shadow.mul)}` : `свет · ступень ${Math.min(lv + (cost == null ? 0 : 1), n)} из ${n}`, x + 24 + n * 22 + 6, y + 71, { size: 13, align: 'left', color: sh ? '#b9a0e0' : '#ffcf7a' });
      if (lv > 0 && button(ctx, inp, x + 304, y + 6, 114, 26, sh ? 'К свету' : 'К тени', { size: 15 })) {
        sv.side[u.id] = sh ? 'light' : 'shadow'; app.persist(); sfx(sh ? 'bells' : 'dread', { vol: 0.3 }); flashId = u.id; flashT = 0.4;
      }
      if (cost == null) text(ctx, 'освоено', x + 361, y + 56, { size: 16, color: '#8fdc7a' });
      else if (button(ctx, inp, x + 298, y + 40, 120, 34, `${cost} ✦`, { size: 17, disabled: (sv.shards || 0) < cost })) {
        sv.shards -= cost; sv.up[u.id] = lv + 1; app.persist(); sfx('bells', { vol: 0.4 }); flashId = u.id; flashT = 0.5;
      }
    });
    // восьмая клетка: куда идти дальше
    const x = 480, y = 128 + 3 * 86; comicBox(ctx, x, y, 430, 82, 0.6);
    const left = UPGRADES.reduce((a, u) => a + (u.steps.length - (sv.up?.[u.id] || 0)), 0);
    text(ctx, left ? `Ступеней впереди: ${left}` : 'Алтарь освоен', x + 215, y + 24, { size: 17, sc: true, color: '#cdb6a0' });
    text(ctx, 'Сила ступеней мала и растёт всё дороже.', x + 215, y + 46, { size: 15, color: '#a99382' });
    text(ctx, 'Новое — в Хранилище и в Гневе Ареса.', x + 215, y + 66, { size: 15, color: '#a99382' });
  }
  // ---- вкладка «Хранилище»: знамения, реликвии, рубашки; цены видны, предметы-силуэты открываются за осколки
  function drawVault(ctx, inp, P) {
    const sv = save(), list = vaultList(sv), per = 12, pages = Math.ceil(list.length / per); page = Math.min(page, pages - 1);
    const own = list.filter(it => vaultOwned(sv, it)).length;
    text(ctx, `Открыто ${own} из ${list.length}`, 480, 104, { size: 16, color: '#cdb6a0' });
    list.slice(page * per, page * per + per).forEach((it, i) => {
      const c = i % 4, r = Math.floor(i / 4), x = 32 + c * 226, y = 120 + r * 102, o = vaultOwned(sv, it), worn = it.kind === 'back' && sv.cos?.back === it.id;
      const hov = P.x > x && P.x < x + 218 && P.y > y && P.y < y + 96;
      comicBox(ctx, x, y, 218, 96, hov ? 1 : o ? 0.9 : 0.62);
      if (hov) { ctx.strokeStyle = o ? '#ffcf7a' : '#7d6a5e'; ctx.lineWidth = 2; ctx.strokeRect(x - 2, y - 2, 222, 100); hovDetail = it; }
      if (flashId === it.key && flashT > 0) { ctx.fillStyle = `rgba(255,207,122,${flashT * 0.5})`; ctx.fillRect(x + 4, y + 4, 210, 88); }
      emblem(ctx, it, x + 38, y + 40, 24, o);
      text(ctx, KIND_NAME[it.kind], x + 78, y + 15, { size: 13, sc: true, align: 'left', color: KIND_COL[it.kind] });
      wrap(ctx, it.name, 130, 15).slice(0, 2).forEach((l, k) => text(ctx, l, x + 78, y + 34 + k * 17, { size: 15, align: 'left', color: o ? '#efdcc4' : '#8d7a6d' }));
      if (o) text(ctx, worn ? '✓ надета' : it.kind === 'back' ? '✓ открыта · надеть' : '✓ открыто', x + 78, y + 82, { size: 14, align: 'left', color: worn ? '#ffe08a' : '#8fdc7a' });
      else if (it.need) text(ctx, 'Награда достижения', x + 78, y + 82, { size: 13, align: 'left', color: '#b08a6a' });
      else if (it.wrath) text(ctx, `Пройти на Гневе ${it.wrath - 1}`, x + 78, y + 82, { size: 13, align: 'left', color: '#b08a6a' });
      else if (button(ctx, inp, x + 76, y + 66, 134, 24, `Открыть · ${it.cost} ✦`, { size: 14, disabled: (sv.shards || 0) < it.cost })) buy(it);
      if (o && it.kind === 'back' && hov && P.clicked) { P.clicked = false; app.setBack(worn ? null : it.id); sfx('flip', { vol: 0.5 }); }
    });
    // подробности под наведением
    comicBox(ctx, 32, 428, 896, 54, 0.92);
    const d = hovDetail;
    if (d) {
      const o = vaultOwned(sv, d);
      text(ctx, d.name, 50, 448, { size: 17, sc: true, align: 'left', color: o ? '#ffe0a8' : '#cdb6a0' });
      if (d.plus) { text(ctx, 'дар: ' + d.plus, 50, 468, { size: 14, align: 'left', color: '#cfeec0' }); text(ctx, 'цена: ' + d.minus + (d.mul ? ` · осколки ×${String(d.mul).replace('.', ',')}` : ''), 480, 468, { size: 14, align: 'left', color: '#f4c4b8' }); }
      else text(ctx, (d.need ? `Достижение «${d.ach}»: ` : '') + (d.desc || ''), 50, 468, { size: 14, align: 'left', color: '#d9c2a8' });
    } else text(ctx, 'Наведи на предмет — увидишь, что он даёт и чем платишь. Знамения и реликвии меняют правила, а не силу.', 480, 455, { size: 15, color: '#a99382' });
    if (pages > 1) {
      if (button(ctx, inp, 36, 490, 44, 38, (STYLE.pixel ? '<' : '‹'), { size: 20, disabled: page <= 0 })) page--;
      text(ctx, `${page + 1} / ${pages}`, 112, 510, { size: 16, color: '#cdb6a0' });
      if (button(ctx, inp, 146, 490, 44, 38, (STYLE.pixel ? '>' : '›'), { size: 20, disabled: page >= pages - 1 })) page++;
    }
  }
  // ---- вкладка «Забег»: Гнев Ареса (давление вместо силы) и что держит этот проход; всё остальное — навсегда
  function drawRun(ctx, inp, P) {
    const sv = save(), run = sv.run || {}, max = sv.wrath?.max || 0, can = pickable();
    comicBox(ctx, 30, 118, 456, 362, 0.88);
    text(ctx, 'Гнев Ареса', 48, 140, { size: 20, sc: true, align: 'left', color: '#ff9a8a' });
    text(ctx, can ? 'Выбор — до начала прохода' : 'Менять можно в новой игре', 468, 140, { size: 14, align: 'right', color: '#a99382' });
    for (let k = 0; k <= WRATH_MAX; k++) {
      const y = 154 + k * 29, open = k <= max, sel = (can ? sv.wrath?.sel : run.wrath) === k, hov = P.x > 40 && P.x < 476 && P.y > y && P.y < y + 27;
      if (sel) { ctx.fillStyle = 'rgba(255,154,138,0.16)'; ctx.fillRect(40, y, 436, 27); ctx.strokeStyle = '#ff9a8a'; ctx.lineWidth = 1.5; ctx.strokeRect(40.5, y + 0.5, 435, 26); }
      else if (hov && open) { ctx.fillStyle = 'rgba(255,207,122,0.08)'; ctx.fillRect(40, y, 436, 27); }
      const w = k ? WRATH[k] : { name: 'Обычная ночь', rule: 'Без давления' };
      text(ctx, String(k), 54, y + 14, { size: 16, color: open ? '#ffcf7a' : '#6d5d52', sc: true });
      if (open) { text(ctx, w.name, 74, y + 8, { size: 15, align: 'left', color: '#efdcc4' }); text(ctx, w.rule, 74, y + 21, { size: 13, align: 'left', color: '#a99382' }); }
      else { lockIcon(ctx, 62, y + 14, 5); text(ctx, k === max + 1 ? `${w.name} — пройди игру на Гневе ${k - 1}` : w.name, 74, y + 14, { size: 15, align: 'left', color: '#6d5d52' }); }
      text(ctx, '×' + String(WRATH_MUL[k]).replace('.', ','), 466, y + 14, { size: 14, align: 'right', color: open ? '#ffe0a8' : '#6d5d52' });
      if (hov && open && can && P.clicked) { P.clicked = false; sv.wrath.sel = k; app.persist(); sfx('flip', { vol: 0.5 }); }
    }
    comicBox(ctx, 500, 118, 430, 362, 0.88);
    text(ctx, 'Этот забег', 518, 140, { size: 20, sc: true, align: 'left', color: '#ffe0a8' });
    text(ctx, 'Гнев Ареса: ' + (run.wrath || 0) + ' · осколки ×' + String(wrathMul(run.wrath || 0)).replace('.', ','), 518, 164, { size: 15, align: 'left', color: '#d9c2a8' });
    text(ctx, 'Реликвии (до конца прохода)', 518, 192, { size: 14, sc: true, align: 'left', color: '#ffcf7a' });
    for (let k = 0; k < RELIC_MAX; k++) {
      const id = run.relics?.[k], r = id && relicOf(id), y = 202 + k * 56;
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(516, y, 400, 50);
      if (r) { text(ctx, r.name, 528, y + 13, { size: 15, align: 'left', color: '#efdcc4' }); text(ctx, r.plus, 528, y + 29, { size: 12, align: 'left', color: '#cfeec0' }); text(ctx, r.minus, 528, y + 43, { size: 12, align: 'left', color: '#f4c4b8' }); }
      else text(ctx, `пусто · выбор 1 из 3 перед полем «${['Вороны Ареса', 'Туман у реки', 'Страх и Ужас'][k]}»`, 528, y + 26, { size: 14, align: 'left', color: '#7d6a5e' });
    }
    const left = UPGRADES.reduce((a, u) => a + (u.steps.length - (sv.up?.[u.id] || 0)), 0), list = vaultList(sv), own = list.filter(it => vaultOwned(sv, it)).length;
    text(ctx, 'Навсегда', 518, 384, { size: 14, sc: true, align: 'left', color: '#ffcf7a' });
    text(ctx, `Ступеней алтаря впереди: ${left} · Хранилище: ${own} из ${list.length} · Гнев открыт до ${max}`, 518, 406, { size: 14, align: 'left', color: '#cdb6a0' });
    wrap(ctx, 'Осколки, алтарь, Хранилище и Гнев остаются навсегда. Реликвии и знамения живут один проход; упрямство отца (+1 глоток после двух смертей на поле) сбрасывается победой.', 400, 13).slice(0, 4).forEach((l, i) => text(ctx, l, 518, 430 + i * 15, { size: 13, align: 'left', color: '#a99382' }));
  }
}

// Знамение перед полем: 1 из 3 (плюс и цена), как реликвии карточных рогаликов. Держится до победы на этом поле.
export function createOmen(app) {
  let O = null;
  const choose = o => { if (!O || O.done) return; O.done = true; app.save.omen = o ? { id: o.id, field: O.id } : { id: null, field: O.id }; app.persist(); sfx(o ? 'bells' : 'air', { vol: 0.35 }); O.onDone(); };
  return {
    enter(game, { id, onDone }) {
      migrate(app.save);
      const def = FIELDS[id], pool = ALL_OMENS.filter(o => !(o.pairs?.decoy && def.son == null) && !(o.need && !app.save.ach?.[o.need]) && !(o.cost && !app.save.unlocked?.['o:' + o.id]));   // need — достижение; cost — открыто в Хранилище
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      O = { id, onDone, opts: pool.slice(0, 3), t: 0, done: false }; setMood('memory');
    },
    update(dt) { if (O) O.t += dt; app.inp.endStep(); },
    toText: () => ({ scene: 'omen', id: O?.id, opts: O?.opts.map(o => o.id) }),
    choose: i => choose(i == null ? null : O.opts[i]), // для тестов
    draw(ctx) {
      if (!O) return;
      const def = FIELDS[O.id], P = app.inp.pointer;
      ctx.fillStyle = '#060304'; ctx.fillRect(0, 0, W, H);
      const im = img(def.bg); if (im) { ctx.globalAlpha = 0.35; drawCam(ctx, im, [0.5, 0.5, 1.1]); ctx.globalAlpha = 1; }
      text(ctx, 'Знамение', W / 2, 50, { size: 34, sc: true, spacing: 3 });
      text(ctx, `${def.sub}. Ночь подаёт знак — выбери один. Он останется до победы на этом поле.`, W / 2, 88, { size: 16, color: '#cdb6a0' });
      O.opts.forEach((o, i) => {
        const x = 50 + i * 292, y = 118, w = 276, h = 300, hov = O.t > 0.4 && P.x > x && P.x < x + w && P.y > y && P.y < y + h;
        comicBox(ctx, x, y, w, h, hov ? 1 : 0.88);
        if (hov) { ctx.strokeStyle = '#ffcf7a'; ctx.lineWidth = 2; ctx.strokeRect(x - 3, y - 3, w + 6, h + 6); }
        text(ctx, String(i + 1), x + 22, y + 24, { size: 16, color: '#a58f7e' });
        if (o.need) text(ctx, 'награда ✦', x + w - 18, y + 24, { size: 16, align: 'right', color: '#ffcf7a' });
        text(ctx, o.name, x + w / 2, y + 44, { size: 24, sc: true, color: '#f2e2cc' });
        text(ctx, 'дар', x + w / 2, y + 86, { size: 13, sc: true, color: '#8fdc7a', spacing: 2 });
        wrap(ctx, o.plus, w - 40, 17).forEach((l, k) => text(ctx, l, x + w / 2, y + 110 + k * 22, { size: 17, color: '#cfeec0' }));
        text(ctx, 'цена', x + w / 2, y + 172, { size: 13, sc: true, color: '#ff9a8a', spacing: 2 });
        wrap(ctx, o.minus, w - 40, 17).forEach((l, k) => text(ctx, l, x + w / 2, y + 196 + k * 22, { size: 17, color: '#f4c4b8' }));
        text(ctx, 'осколки ×' + String(o.mul).replace('.', ','), x + w / 2, y + h - 26, { size: 16, sc: true, color: o.mul > 1 ? '#ffe0a8' : o.mul < 1 ? '#b8a898' : '#cdb6a0' });
        if ((hov && P.clicked) || app.inp.uiHit('Digit' + (i + 1))) { P.clicked = false; choose(o); }
      });
      if (O.t > 0.4 && button(ctx, app.inp, W / 2 - 110, H - 86, 220, 44, 'Не гадать', { size: 17 })) choose(null);
      drawPost(ctx, { tint: '#3a3050', tintA: 0.14 });
    },
  };
}

// Реликвия забега: 1 из 3 перед f3, f5, f7 — плюс и цена, держится до конца прохода (в отличие от знамения поля)
export function createRelic(app) {
  let R = null;
  const choose = r => { if (!R || R.done) return; R.done = true; const run = app.save.run; if (r) run.relics.push(r.id); run.drafted[R.id] = 1; app.persist(); sfx(r ? 'bells' : 'air', { vol: 0.35 }); R.onDone(); };
  return {
    enter(game, { id, onDone }) {
      migrate(app.save);
      const pool = relicPool(app.save);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      R = { id, onDone, opts: pool.slice(0, 3), t: 0, done: false }; setMood('memory');
    },
    update(dt) { if (R) R.t += dt; app.inp.endStep(); },
    toText: () => ({ scene: 'relic', id: R?.id, opts: R?.opts.map(o => o.id), held: app.save.run?.relics }),
    choose: i => choose(i == null ? null : R.opts[i]), // для тестов
    draw(ctx) {
      if (!R) return;
      const def = FIELDS[R.id], P = app.inp.pointer, held = app.save.run.relics;
      ctx.fillStyle = '#060304'; ctx.fillRect(0, 0, W, H);
      const im = img(def.bg); if (im) { ctx.globalAlpha = 0.3; drawCam(ctx, im, [0.5, 0.5, 1.1]); ctx.globalAlpha = 1; }
      text(ctx, 'Реликвия отца', W / 2, 48, { size: 34, sc: true, spacing: 3 });
      text(ctx, `Выбери одну. Она останется до конца прохода (${held.length} из ${RELIC_MAX}) — и плюс, и цена.`, W / 2, 86, { size: 16, color: '#cdb6a0' });
      R.opts.forEach((o, i) => {
        const x = 50 + i * 292, y = 118, w = 276, h = 300, hov = R.t > 0.4 && P.x > x && P.x < x + w && P.y > y && P.y < y + h;
        comicBox(ctx, x, y, w, h, hov ? 1 : 0.88);
        if (hov) { ctx.strokeStyle = '#ffcf7a'; ctx.lineWidth = 2; ctx.strokeRect(x - 3, y - 3, w + 6, h + 6); }
        text(ctx, String(i + 1), x + 22, y + 24, { size: 16, color: '#a58f7e' });
        drawBadge(ctx, { crest: CRESTS[(hash('r:' + o.id) >> 3) % 8], crest2: CRESTS[(hash('r:' + o.id) >> 3) % 8], glyph: GLYPHS[hash('r:' + o.id) % 8] }, x + w / 2, y + 62, 26);
        text(ctx, o.name, x + w / 2, y + 112, { size: 22, sc: true, color: '#f2e2cc' });
        text(ctx, 'дар', x + w / 2, y + 140, { size: 13, sc: true, color: '#8fdc7a', spacing: 2 });
        wrap(ctx, o.plus, w - 40, 17).forEach((l, k) => text(ctx, l, x + w / 2, y + 162 + k * 21, { size: 17, color: '#cfeec0' }));
        text(ctx, 'цена', x + w / 2, y + 214, { size: 13, sc: true, color: '#ff9a8a', spacing: 2 });
        wrap(ctx, o.minus, w - 40, 17).forEach((l, k) => text(ctx, l, x + w / 2, y + 236 + k * 21, { size: 17, color: '#f4c4b8' }));
        if (o.mul) text(ctx, 'осколки ×' + String(o.mul).replace('.', ','), x + w / 2, y + h - 18, { size: 15, sc: true, color: '#ffe0a8' });
        if ((hov && P.clicked) || app.inp.uiHit('Digit' + (i + 1))) { P.clicked = false; choose(o); }
      });
      if (R.t > 0.4 && button(ctx, app.inp, W / 2 - 110, H - 86, 220, 44, 'Без реликвии', { size: 17 })) choose(null);
      drawPost(ctx, { tint: '#3a3050', tintA: 0.14 });
    },
  };
}

