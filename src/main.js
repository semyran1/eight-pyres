// Точка входа: профиль, кампания (сюжет → поля → ночи волков → финал), достижения, хуки для автотестов.
import { createGame } from './engine/core.js';
import { createInput } from './engine/input.js';
import { initAudio, applyVolumes, audioState, sfx, suspendAudio, loadSounds, setAmbient, playMusic } from './engine/audio.js';
import { loadSave, writeSave } from './engine/util.js';
import { DEFAULT_SAVE, CAMPAIGN, ACHIEVEMENTS, FIELDS, updateFatherName } from './game/data.js';
import { loadImages, text, comicBox, W, H, STYLE, cardBack, img, ART, loadArtManifest, setArtSet, nextArtSet, artLabel } from './art/gfx.js';
import { createField } from './game/field.js';
import { createStory } from './game/story.js';
import { createWolves } from './game/wolves.js';
import { createMenu } from './game/menu.js';
import { createMemento } from './game/memento.js';
import { createDeath, createAltar, createOmen, createRelic, needsOmen, needsRelic, newRun, finishRun, migrate, applyReward, syncCos } from './game/meta.js';
import { UPGRADES } from './game/progress.js';
import { starIcon } from './game/ui.js';
import { setLang, pickLang, LANG } from './game/i18n.js';
import { initPlatform, loadingDone, platform } from './engine/platform.js';

const canvas = document.getElementById('game');
const game = createGame(canvas);
const inp = createInput(game);
const save = loadSave(DEFAULT_SAVE);
migrate(save); writeSave(save);   // прогрессия v4: старые покупки алтаря возвращаются осколками
audioState.sfx = save.settings.sfx; audioState.music = save.settings.music;

const toasts = [];
let artToast = null;   // короткий тост «Арт: Qwen»
let cur = null, prev = null, fadeIn = 0, loaded = false;
const app = {
  game, inp, save,
  persist: () => { writeSave(save); updateFatherName(save); },
  updateName: () => updateFatherName(save),
  ach(id) {
    if (save.ach[id]) return; const a = ACHIEVEMENTS.find(x => x.id === id); if (!a) return;
    save.ach[id] = Date.now(); applyReward(save, a); writeSave(save); toasts.push({ a, t: 0 }); sfx('bells', { vol: 0.35 });
  },
  // рубашка карт за достижение (null — обычная)
  setBack(id) { save.cos ||= {}; save.cos.back = id; writeSave(save); syncCos(save); },
  cardBack: id => cardBack(id),
  toggleLang() { save.settings.lang = LANG.v === 'ru' ? 'en' : 'ru'; writeSave(save); setLang(save.settings.lang); },
  toggleStyle() { save.settings.style = STYLE.pixel ? 'paint' : 'pixel'; writeSave(save); const u = new URL(location.href); u.searchParams.delete('style'); location.href = u.toString(); },
  // набор арта (живопись): по кругу исходный → Qwen → Z; без перезагрузки, картинки догружаются в фоне
  cycleArt() {
    if (STYLE.pixel) { artToast = { s: 'Арт — только в живописном стиле', t: 0 }; return; }
    save.settings.artSet = setArtSet(nextArtSet()); writeSave(save); artToast = { s: artLabel(), t: 0 };
  },
  toggleSound() {
    const on = save.settings.sfx > 0; save.settings.sfx = on ? 0 : 0.9; save.settings.music = on ? 0 : 0.5;
    audioState.sfx = save.settings.sfx; audioState.music = save.settings.music; applyVolumes(); writeSave(save);
  },
  goMenu: () => setScene(menu),
  newGame() {
    Object.assign(save, { nameRevealed: false, step: 0, bonusWater: 0, licymnius: false, omen: null, gifts: { gaze: 1, flash: 1, amph: 0 }, chapterGifts: {} });
    newRun(save);   // новый забег: ступень Гнева из выбора, реликвии и упрямство отца с нуля (алтарь и Хранилище остаются)
    writeSave(save); runStep(0);
  },
  // «Новая игра»: стереть всё прохождение (осколки, алтарь, звёзды, достижения, подсказки); настройки остаются
  wipeSave() {
    const keep = { ...save.settings };
    for (const k of Object.keys(save)) delete save[k];
    Object.assign(save, JSON.parse(JSON.stringify(DEFAULT_SAVE)), { settings: { ...DEFAULT_SAVE.settings, ...keep } });
    writeSave(save); updateFatherName(save); syncCos(save); runStep(0);
  },
  startFrom: i => runStep(i),
  next() { save.step++; save.maxStep = Math.max(save.maxStep, save.step); writeSave(save); runStep(save.step); },
  // сюжетная вставка посреди поля (Ликимний жив) — поле не перезапускается
  inlineStory(id, after) {
    const back = cur;
    story.enter(game, { id, onDone: () => { after && after(); cur = back; fadeIn = 1; } });
    cur = story; fadeIn = 1;
  },
  fieldDone(S) {
    // «Без помощи богов»: оба поля главы без даров
    const ch = S.def.title; save.chapterGifts ||= {}; save.chapterGifts[ch] = (save.chapterGifts[ch] || 0) + S.giftsUsed;
    const fieldsOfCh = Object.entries(FIELDS).filter(([, f]) => f.title === ch && f.son != null).map(([id]) => id);
    if (S.son && fieldsOfCh.every(id => save.best[id]) && save.chapterGifts[ch] === 0 && fieldsOfCh.length > 1) app.ach('no_gifts');
    const sonFields = Object.entries(FIELDS).filter(([, f]) => f.son != null).map(([id]) => id);
    if (sonFields.every(id => save.best[id] === 3) && save.best.names === 3) app.ach('all3');
  },
};

updateFatherName(save); syncCos(save);
ART.cycle = () => app.cycleArt();   // кнопка в паузе (ui.js) зовёт сюда
const field = createField(app), story = createStory(app), wolves = createWolves(app), menu = createMenu(app);
const memento = createMemento(app), death = createDeath(app), altar = createAltar(app), omen = createOmen(app), relic = createRelic(app);
// экран смерти получает снимок поля — Харон говорит по причине смерти
app.death = info => {
  const S = field.S, snap = S && S.id === info.id ? { left: S.cards.filter(c => !c.matched && !c.gone).length, total: S.cards.length,
    ravens: S.ravenSwaps || 0, bitten: S.bitten || 0, phobos: !!S.phobos, omen: S.mods?.omen?.id || null } : null;
  setScene(death, { ...info, snap });
};
app.retryField = info => setScene(field, { id: info.id, tries: info.tries });
app.altar = (onBack, tab) => setScene(altar, { onBack, tab });

function setScene(s, opts) { prev = cur; cur = s; s.enter?.(game, opts); fadeIn = 1; }
function runStep(i) {
  const st = CAMPAIGN[i];
  save.step = i; save.maxStep = Math.max(save.maxStep, i); writeSave(save);
  if (!st || st.t === 'end') {
    save.finished = true; save.step = 0; const nw = finishRun(save); writeSave(save); app.ach('ending');
    if (nw) toasts.push({ a: { name: 'Гнев Ареса ' + nw, reward: { name: 'Новая ступень сложности' } }, t: 0 });   // пройдена высшая ступень — открыта следующая
    setScene(menu); return;
  }
  if (st.t === 'story') {
    if (st.id === 'ch3' || st.id === 'styx') { save.bonusWater = 0; }
    setScene(story, { id: st.id, onDone: () => app.next() });
  }
  else if (st.t === 'field') {   // перед полем: реликвия забега (f3, f5, f7) → знамение поля сына → поле
    const toField = () => { if (needsOmen(save, st.id)) setScene(omen, { id: st.id, onDone: () => setScene(field, { id: st.id }) }); else setScene(field, { id: st.id }); };
    if (needsRelic(save, st.id)) setScene(relic, { id: st.id, onDone: toField }); else toField();
  }
  else if (st.t === 'wolves') setScene(wolves, { id: st.id });
  else if (st.t === 'memento') setScene(memento, { kind: st.kind, son: st.son });
}

game.setScene({
  update(dt, rdt) {
    if (!loaded) { inp.endStep(); return; }
    cur?.update?.(dt, rdt);
    if (artToast && (artToast.t += rdt) > 1.6) artToast = null;
    for (const t of toasts) t.t += rdt; while (toasts.length && toasts[0].t > (toasts[0].a.reward ? 4.6 : 3.4)) toasts.shift();
    fadeIn = Math.max(0, fadeIn - rdt * 1.8);
  },
  draw(ctx) {
    if (!loaded) {
      ctx.fillStyle = '#060304'; ctx.fillRect(0, 0, W, H);
      text(ctx, 'Восемь костров', W / 2, H / 2 - 20, { size: 44, sc: true, color: '#e8d2b8' });
      text(ctx, 'Загрузка…', W / 2, H / 2 + 26, { size: 18, color: '#a58f7e' });
      inp.endFrame(); return;
    }
    cur?.draw?.(ctx);
    if (fadeIn > 0) { ctx.fillStyle = `rgba(6,3,4,${fadeIn})`; ctx.fillRect(0, 0, W, H); }
    let ty = 64;
    toasts.slice(0, 3).forEach(o => {   // тост достижения; с наградой — выше и дольше, строка награды отдельно
      const rw = o.a.reward, life = rw ? 4.6 : 3.4, tw = rw ? 340 : 270, th = rw ? 76 : 52;
      const k = o.t < 0.3 ? o.t / 0.3 : o.t > life - 0.4 ? (life - o.t) / 0.4 : 1, x = W + 10 - (tw + 20) * Math.min(1, k), y = ty; ty += th + 6;
      ctx.globalAlpha = Math.max(0, k); comicBox(ctx, x, y, tw, th);
      starIcon(ctx, x + 26, y + 26, 13, true);
      text(ctx, 'Достижение', x + 48, y + 17, { size: 13, align: 'left', sc: true, color: '#ffcf7a', spacing: 1 });
      text(ctx, o.a.name, x + 48, y + 37, { size: 18, align: 'left' });
      if (rw) text(ctx, '+ ' + rw.name, x + 48, y + 60, { size: 16, align: 'left', color: '#a8e08e' });
      ctx.globalAlpha = 1;
    });
    if (artToast) { const a = Math.min(1, artToast.t * 6, (1.6 - artToast.t) * 3); ctx.globalAlpha = Math.max(0, a); comicBox(ctx, W / 2 - 150, H - 58, 300, 40); text(ctx, artToast.s, W / 2, H - 37, { size: 18, color: '#ffe0a8' }); ctx.globalAlpha = 1; }
    // телефон вертикально: игра горизонтальная
    if (innerHeight > innerWidth * 1.1) { ctx.fillStyle = 'rgba(6,3,4,0.92)'; ctx.fillRect(0, 0, W, H); text(ctx, 'Поверните телефон', W / 2, H / 2 - 10, { size: 48, sc: true }); text(ctx, 'Игра идёт в горизонтальном положении', W / 2, H / 2 + 40, { size: 24, color: '#bfa996' }); }
    inp.endFrame();
  },
});

// звук — по первому жесту (политика браузеров)
const unlock = () => { initAudio(); applyVolumes(); };
addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
// F2 — переключить набор арта где угодно (меню, рассказ, поле, пауза)
addEventListener('keydown', e => { if (e.code === 'F2') { e.preventDefault(); if (loaded && !e.repeat) app.cycleArt(); } });
document.addEventListener('visibilitychange', () => suspendAudio(document.hidden));

// хуки проверки агентом
window.render_game_to_text = () => JSON.stringify(cur?.toText?.() || { scene: 'loading' });
window.advanceTime = ms => game.step(Math.round(ms / (1000 / 60)));
Object.assign(window, { __FIELDS: FIELDS, __memento: memento, __death: death, __altar: altar, __omen: omen, __relic: relic, __fullUp: () => Object.fromEntries(UPGRADES.map(u => [u.id, u.steps.length])), __app: app, __field: field, __wolves: wolves, __story: story, __menu: menu, __run: runStep, __set: (s, o) => setScene(s, o), __toasts: toasts, __art: { ART, img, toast: () => artToast } });

const Q = new URLSearchParams(location.search);
STYLE.pixel = Q.get('style') ? Q.get('style') === 'pixel' : save.settings.style === 'pixel';
game.pixel = STYLE.pixel;
// шрифты из @import обнаруживаются поздно — грузим явно оба набора знаков (кириллица и латиница)
function loadFonts() {
  if (!document.fonts?.load) return Promise.resolve();
  const f = ['600 16px "Cormorant Garamond"', 'italic 600 16px "Cormorant Garamond"', '700 16px "Cormorant Garamond"',
    '600 16px "Cormorant SC"', '700 16px "Cormorant SC"', '500 16px "Pixelify Sans"'];
  return Promise.all(f.map(x => document.fonts.load(x, 'Аа Aa').catch(() => {})));
}
initPlatform().then(() => setLang(Q.get('lang') || save.settings.lang || pickLang(platform.lang))).then(() => Promise.all([loadImages(), loadSounds(), loadFonts(), loadArtManifest(Q.get('artroot'))])).then(() => {
  loaded = true; loadingDone();
  setArtSet(Q.get('art') || (['sin', 'mos'].includes(save.settings.artSet) ? save.settings.artSet : 'sin'));   // ?art=qwen|z|base — для проверок
  if (Q.has('field')) setScene(field, { id: Q.get('field') });
  else if (Q.has('wolves')) setScene(wolves, { id: Q.get('wolves') });
  else if (Q.has('memento')) setScene(memento, { kind: Q.get('memento'), son: +(Q.get('son') || 0) });
  else if (Q.has('story')) setScene(story, { id: Q.get('story'), onDone: () => setScene(menu) });
  else if (Q.has('step')) runStep(+Q.get('step'));
  else setScene(menu);
});
