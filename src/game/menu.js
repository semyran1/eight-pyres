// Главное меню: небо со звёздами сыновей, арт автора (красное солнце, вороны), одна главная кнопка.
// Журнал «Сыновья» (приметы — для финала у Стикса) и «Достижения» — оверлеи.
import { SONS, CAMPAIGN, FIELDS, ACHIEVEMENTS, stepLabel } from './data.js';
import { STYLE, img, W, H, text, wrap, button, comicBox, drawCam, drawSky, drawConstellation, drawBadge, Rain, drawPost, ART, artLabel } from '../art/gfx.js';
import { playMusic, setAmbient, sfx } from '../engine/audio.js';
import { setMood } from '../engine/score.js';
import { LANG } from './i18n.js';
import { starIcon } from './ui.js';
import { WRATH, WRATH_MUL, nextGoal } from './progress.js';

export function createMenu(app) {
  let t = 0, overlay = null, confirmNew = false;
  const rain = new Rain(160);
  function sonsMet() { // сыновья, чьи поля уже открыты
    const met = new Set();
    CAMPAIGN.forEach((s, i) => { if (s.t === 'field' && i <= app.save.maxStep && FIELDS[s.id].son != null) met.add(FIELDS[s.id].son); });
    return met;
  }
  function sonsBurned() { const b = new Set(); for (const [id, st] of Object.entries(app.save.best)) if (st && FIELDS[id]?.son != null) b.add(FIELDS[id].son); return b; }
  return {
    enter() { t = 0; overlay = null; confirmNew = false; playMusic(null); setMood('menu'); setAmbient({ rain: 0.18, night: 0.25, fire: 0, howls: 0, wind: 0.1 }); rain.amount = 0.35; },
    update(dt) { t += dt; rain.update(dt); app.inp.endStep(); },
    toText: () => ({ scene: 'menu', overlay, step: app.save.step }),
    draw(ctx) {
      const inp = app.inp;
      drawSky(ctx, t);
      const burned = sonsBurned();
      const lit = SONS.map((s, i) => burned.has(i)); lit.push(app.save.finished);
      // арт автора: воин под красным солнцем, медленный наезд
      ctx.save(); ctx.globalAlpha = 0.92;
      const im = img('menu_a'); if (im) { const k = 0.5 + Math.sin(t * 0.05) * 0.02; drawCam(ctx, im, [k, 0.5, 1.06 + Math.sin(t * 0.07) * 0.02], 0, 0, W, H); }
      ctx.restore();
      // звёзды сыновей — в небе над артом
      ctx.save(); ctx.globalAlpha = 0.9; drawConstellation(ctx, t, lit, { lines: app.save.finished ? 1 : 0.6, s: 0.62, x: 330, y: -96 }); ctx.restore();
      if (STYLE.pixel) { for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(6,3,5,${0.8 - i * 0.13})`; ctx.fillRect(i * 96, 0, 96, H); } }   // ступени затемнения слева (без плавного градиента)
      else { const g = ctx.createLinearGradient(0, 0, W * 0.6, 0); g.addColorStop(0, 'rgba(6,3,5,0.85)'); g.addColorStop(1, 'rgba(6,3,5,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      rain.draw(ctx);
      drawPost(ctx, { tint: '#6b3a48', tintA: 0.12 }); // виньетка под интерфейсом — кнопки в углах не темнеют
      text(ctx, 'Восемь костров', 60, 120, { size: 64, sc: true, align: 'left', spacing: 2, color: '#f0dcc2' });
      text(ctx, 'Ночь после битвы. Дождь. Поле, которое некому убрать.', 64, 168, { size: 19, align: 'left', color: '#c9a98e' });
      ctx.fillStyle = '#8a1c20'; ctx.fillRect(64, 190, 160, 2);
      const has = app.save.step > 0 && !app.save.finished;
      const any = app.save.maxStep > 0 || (app.save.shards || 0) > 0 || Object.keys(app.save.ach || {}).length > 0;
      if (!overlay) {
        // как в Blood: одна главная кнопка; «Новая игра» — мелкой ссылкой с подтверждением; остальное — жетоны в углу
        const main = has ? 'Продолжить' : app.save.finished ? 'Пройти снова' : 'Начать путь';
        if (button(ctx, inp, 60, 230, 340, 60, main, { key: 'Enter' })) { sfx('gong', { vol: 0.5 }); has ? app.startFrom(app.save.step) : app.newGame(); }
        if (has) text(ctx, stepLabel(app.save.step), 230, 306, { size: 16, color: '#bfa996' });
        let y = has ? 340 : 316;
        // Гнев Ареса: ступень выбирается до начала прохода (открыта после первого прохождения), в проходе — только показ
        const wr = app.save.wrath || { max: 0, sel: 0 }, run = app.save.run || {};
        if (!has && wr.max > 0) {
          const k = Math.min(wr.sel || 0, wr.max), w = k ? WRATH[k] : { name: 'Обычная ночь', rule: 'Без давления' };
          if (button(ctx, inp, 60, 300, 44, 34, (STYLE.pixel ? '<' : '‹'), { size: 20, disabled: k <= 0 })) { wr.sel = k - 1; app.persist(); sfx('flip', { vol: 0.4 }); }
          if (button(ctx, inp, 356, 300, 44, 34, (STYLE.pixel ? '>' : '›'), { size: 20, disabled: k >= wr.max })) { wr.sel = k + 1; app.persist(); sfx('flip', { vol: 0.4 }); }
          text(ctx, `Гнев Ареса ${k} · осколки ×${String(WRATH_MUL[k]).replace('.', ',')}`, 230, 318, { size: 16, color: k ? '#ff9a8a' : '#cdb6a0' });
          wrap(ctx, w.name + ': ' + w.rule, 340, 14).slice(0, 2).forEach((l, i) => text(ctx, l, 230, 350 + i * 16, { size: 14, color: '#a99382' }));
          y = 392;
        } else if (has && run.wrath > 0) text(ctx, `Гнев Ареса ${run.wrath} · осколки ×${String(WRATH_MUL[run.wrath]).replace('.', ',')}`, 230, 326, { size: 14, color: '#ff9a8a' });
        if (any) {
          if (!confirmNew) { if (link(ctx, inp, 'Новая игра', 64, y, 16)) { confirmNew = true; sfx('flip', { vol: 0.4 }); } }
          else {
            text(ctx, 'Стереть всё прохождение и начать заново?', 64, y, { size: 15, align: 'left', color: '#ffcf9a' });
            if (link(ctx, inp, 'Да, стереть', 64, y + 26, 16, '#ff9a8a')) { confirmNew = false; sfx('gong', { vol: 0.5 }); app.wipeSave(); }
            if (link(ctx, inp, 'Нет', 220, y + 26, 16)) confirmNew = false;
          }
          y += confirmNew ? 60 : 34;
        }
        // Алтарь памяти появляется, когда есть что на нём тратить
        if ((app.save.shards || 0) > 0 || (app.save.stats?.deaths || 0) > 0) { if (button(ctx, inp, 60, Math.max(y, 380), 340, 44, `Алтарь памяти  ✦ ${app.save.shards || 0}`, { size: 17, glow: (g => !!g && (app.save.shards || 0) >= g.cost)(nextGoal(app.save)) })) app.altar(null, 'altar'); }   // тлеет, когда хватает на ближайшую цель
        // жетоны справа сверху
        const got = ACHIEVEMENTS.filter(x => app.save.ach[x.id]).length;
        let tx = W - 16;
        const token = (label, w) => { tx -= w; const hit = button(ctx, inp, tx, 14, w, 36, label, { size: 14 }); tx -= 8; return hit; };
        if (token('Настройки', 120)) overlay = 'opts';
        if (token(`Достижения ${got}/${ACHIEVEMENTS.length}`, 176)) overlay = 'ach';
        if (sonsMet().size > 0 && token('Сыновья', 100)) overlay = 'sons';
      } else if (overlay === 'sons') drawSons(ctx, inp);
      else if (overlay === 'ach') drawAch(ctx, inp);
      else if (overlay === 'opts') drawOpts(ctx, inp);
    },
  };
  // ссылка-текст: подчёркивание при наведении
  function link(ctx, inp, label, x, y, size, color = '#d8c3ae') {
    ctx.save(); ctx.font = `600 ${size}px "Cormorant Garamond", serif`; const w = ctx.measureText(label).width * (STYLE.pixel ? 1.1 : 1); ctx.restore();
    const P = inp.pointer, hov = P.x > x - 4 && P.x < x + w + 4 && P.y > y - size && P.y < y + size * 0.6;
    text(ctx, label, x, y, { size, align: 'left', color: hov ? '#ffe0a8' : color });
    ctx.fillStyle = hov ? '#ffe0a8' : 'rgba(216,195,174,0.4)'; ctx.fillRect(x, y + size * 0.55, w, hov ? 2 : 1);
    if (hov && P.clicked) { P.clicked = false; return true; } return false;
  }
  function drawOpts(ctx, inp) {
    ctx.fillStyle = 'rgba(6,3,5,0.82)'; ctx.fillRect(0, 0, W, H);
    text(ctx, 'Настройки', W / 2, 110, { size: 32, sc: true });
    if (button(ctx, inp, W / 2 - 150, 150, 300, 48, app.save.settings.sfx > 0 ? 'Звук: включён' : 'Звук: выключен', { size: 18 })) app.toggleSound();
    if (button(ctx, inp, W / 2 - 150, 206, 300, 48, STYLE.pixel ? 'Стиль: пиксели' : 'Стиль: живопись', { size: 18 })) app.toggleStyle();
    if (button(ctx, inp, W / 2 - 150, 262, 300, 48, LANG.v === 'ru' ? 'Язык: русский' : 'Язык: English', { size: 18 })) app.toggleLang();
    // набор арта для сравнения (только живопись); F2 — то же из любого места
    if (button(ctx, inp, W / 2 - 150, 318, 300, 48, artLabel(), { size: 18, disabled: STYLE.pixel })) app.cycleArt();
    if (ART.sets.length > 1 && !STYLE.pixel) text(ctx, 'F2 — сменить арт в любой момент', W / 2, 452, { size: 15, color: '#a58f7e' });
    if (button(ctx, inp, W / 2 - 90, 380, 180, 44, 'Назад', { size: 17, key: 'Escape' })) overlay = null;
  }
  function drawSons(ctx, inp) {
    ctx.fillStyle = 'rgba(6,3,5,0.8)'; ctx.fillRect(0, 0, W, H);
    text(ctx, 'Сыновья Электриона', W / 2, 44, { size: 32, sc: true });
    const met = sonsMet(), burned = sonsBurned();
    SONS.forEach((s, i) => {
      const col = i % 2, row = i >> 1, x = 40 + col * 450, y = 80 + row * 100;
      comicBox(ctx, x, y, 430, 92, 0.85);
      if (met.has(i)) {
        drawBadge(ctx, s, x + 46, y + 46, 30);
        text(ctx, s.name + (burned.has(i) ? '  ✦' : ''), x + 90, y + 24, { size: 21, sc: true, align: 'left', color: burned.has(i) ? '#ffe0a8' : '#ead9c6' });
        text(ctx, s.sign, x + 90, y + 48, { size: 15, align: 'left', color: '#d1b9a2' });
        wrap(ctx, s.about, 320, 14).slice(0, 1).forEach(l => text(ctx, l, x + 90, y + 70, { size: 14, align: 'left', color: '#a99382' }));
      } else text(ctx, '…ещё не найден', x + 215, y + 46, { size: 18, color: '#7d6a5e' });
    });
    if (button(ctx, inp, W / 2 - 90, 488, 180, 42, 'Назад', { size: 17, key: 'Escape' })) overlay = null;
  }
  function drawAch(ctx, inp) {
    ctx.fillStyle = 'rgba(6,3,5,0.9)'; ctx.fillRect(0, 0, W, H);
    const got = ACHIEVEMENTS.filter(a => app.save.ach[a.id]).length, P = inp.pointer, cos = app.save.cos || {};
    text(ctx, `Достижения ${got}/${ACHIEVEMENTS.length}`, W / 2, 36, { size: 30, sc: true });
    // награда — справа в строке; наведение — подробности внизу; клик по полученной рубашке — надеть/снять
    const KIND = { back: 'рубашка', omen: 'знамение', memory: 'воспоминание', star: 'звезда', gift: 'дар' };
    let hov = null;
    ACHIEVEMENTS.forEach((a, i) => {
      const col = i % 2, row = Math.floor(i / 2), x = 50 + col * 440, y = 62 + row * 44;
      const on = !!app.save.ach[a.id], rw = a.reward, over = P.x > x && P.x < x + 430 && P.y > y - 2 && P.y < y + 40;
      if (over) { hov = a; ctx.fillStyle = 'rgba(255,207,122,0.08)'; ctx.fillRect(x - 4, y - 2, 438, 42); }
      starIcon(ctx, x + 14, y + 18, 11, on);
      text(ctx, a.name, x + 34, y + 11, { size: 17, align: 'left', sc: true, color: on ? '#ffe0a8' : '#8d7a6d' });
      text(ctx, a.desc, x + 34, y + 30, { size: 14, align: 'left', color: on ? '#cdb6a0' : '#6d5d52' });
      if (rw) {
        const worn = rw.kind === 'back' && cos.back === rw.id;
        text(ctx, worn ? '✓ надета' : (on ? '✓ ' : '+ ') + KIND[rw.kind], x + 424, y + 11, { size: 14, align: 'right', color: worn ? '#ffe08a' : on ? '#a8e08e' : '#b08a6a' });
      }
      if (over && P.clicked && on && rw?.kind === 'back') { P.clicked = false; app.setBack(cos.back === rw.id ? null : rw.id); sfx('flip', { vol: 0.5 }); }
    });
    // подробности награды
    const sel = hov?.reward ? hov : null, bx = 50, by = 414;
    comicBox(ctx, bx, by, 860, 64, 0.92);
    if (sel) {
      const rw = sel.reward, on = !!app.save.ach[sel.id];
      let tx = bx + 20;
      if (rw.kind === 'back') { const im = app.cardBack(rw.id); if (im) { ctx.save(); ctx.imageSmoothingEnabled = !STYLE.pixel; ctx.globalAlpha = on ? 1 : 0.45; ctx.drawImage(im, bx + 14, by + 6, 34, 52); ctx.restore(); } tx = bx + 62; }
      text(ctx, (on ? 'Награда: ' : 'Откроет: ') + rw.name, tx, by + 20, { size: 17, align: 'left', sc: true, color: on ? '#ffe08a' : '#cdb6a0' });
      const sub = rw.kind === 'memory' ? (on ? `«${rw.text}»` : 'Строка памяти отца — он ответит ею Харону') : rw.kind === 'back' && on ? rw.desc + (cos.back === rw.id ? ' · надета, нажми — снять' : ' · нажми — надеть') : rw.desc;
      wrap(ctx, sub, 860 - (tx - bx) - 20, 16).slice(0, 2).forEach((l, k) => text(ctx, l, tx, by + 42 + k * 18, { size: 16, align: 'left', color: on ? '#e2cfb8' : '#a99382' }));
    } else text(ctx, hov ? 'Это достижение — просто знак памяти.' : 'Наведи на достижение — увидишь награду. Две трети из них что-то открывают.', bx + 430, by + 32, { size: 16, color: '#a99382' });
    app.achView = { hover: hov?.id || null, reward: sel?.reward.name || null };   // для uitest
    if (button(ctx, inp, W / 2 - 90, 488, 180, 42, 'Назад', { size: 17, key: 'Escape' })) overlay = null;
  }
}
