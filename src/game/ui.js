// Общие элементы интерфейса: реплика с портретом, пауза, панель итогов, тосты.
import { text, wrap, comicBox, button, img, W, H, FONT, STYLE, ART, artLabel } from '../art/gfx.js';
import { pxIcon, pxPanel, PAL } from '../art/pixel.js';
import { WHO } from './data.js';
import { tr } from './i18n.js';

// Реплика: печатается побуквенно. d = { text, who, t }
export function drawDialog(ctx, d, x, y, w, h, o = {}) {
  if (!d || !d.text) return;
  const a = Math.min(1, d.t * 4) * (d.fade ?? 1);
  comicBox(ctx, x, y, w, h, 0.95 * a);
  const who = WHO[d.who] || WHO.narr;
  let tx = x + 16, nx = null;
  // compact (узкая колонка поля): маленький портрет рядом с именем, текст — на всю ширину под ними
  if (o.portrait !== false && (d.who === 'father' || !d.who)) {
    const im = img('helm_big'); if (im) { ctx.save(); ctx.globalAlpha = a; const ph = o.compact ? 30 : h - 18, pw = ph * im.width / im.height; ctx.drawImage(im, x + 8, y + (o.compact ? 6 : 9) + Math.sin(d.t * 9) * (d.t < d.text.length / 40 ? 1.2 : 0), pw, ph); ctx.restore(); if (o.compact) nx = x + 14 + pw; else tx = x + 14 + (h - 18) * 0.75; }
  }
  ctx.save(); ctx.globalAlpha = a;
  let yy = y + 20;
  const nm = d.name || who.name;
  if (nm) { text(ctx, nm, nx ?? tx, yy, { size: o.compact ? 16 : 14, align: 'left', sc: true, color: who.color, spacing: 1.5 }); yy += o.compact ? 23 : 18; }
  else if (o.compact && nx) yy += 23;
  const shown = tr(d.text).slice(0, Math.floor(d.t * (o.cps || 48)));
  const lines = wrap(ctx, shown, x + w - tx - 12, o.size || 16);
  lines.slice(0, o.maxLines || 5).forEach((l, i) => text(ctx, l, tx, yy + i * (o.size || 16) * 1.18, { size: o.size || 16, align: 'left', color: d.color || '#eadbca', blur: 3 }));
  ctx.restore();
}

// Пауза. Возвращает 'resume' | 'sound' | 'menu' | null
export function drawPause(ctx, inp, soundOn) {
  ctx.fillStyle = 'rgba(6,3,5,0.72)'; ctx.fillRect(0, 0, W, H);
  text(ctx, 'Пауза', W / 2, 150, { size: 46, sc: true, spacing: 4 });
  if (button(ctx, inp, W / 2 - 130, 205, 260, 52, 'Продолжить')) return 'resume';
  if (button(ctx, inp, W / 2 - 130, 270, 260, 52, soundOn ? 'Звук: вкл' : 'Звук: выкл')) return 'sound';
  if (button(ctx, inp, W / 2 - 130, 335, 260, 52, 'В меню')) return 'menu';
  // набор арта (живопись) — переключается прямо здесь через хук main.js, игра не перезапускается
  if (ART.sets.length > 1 && !STYLE.pixel && button(ctx, inp, W / 2 - 130, 400, 260, 44, artLabel(), { size: 17 })) ART.cycle?.();
  return null;
}

export function starIcon(ctx, x, y, r, on) {
  if (STYLE.pixel) return pxIcon(ctx, on ? 'star' : 'starOff', x, y, r >= 12 ? 4 : 2);
  ctx.save(); ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = on ? '#ffcf7a' : 'rgba(120,100,100,0.35)'; ctx.shadowColor = on ? 'rgba(255,190,90,0.8)' : 'transparent'; ctx.shadowBlur = on ? 12 : 0; ctx.fill();
  ctx.restore();
}

// Кнопка-пауза (иконка) в углу
export function pauseButton(ctx, inp, x, y) {
  const P = inp.pointer, s = 40, hov = P.x > x && P.x < x + s && P.y > y && P.y < y + s;
  if (STYLE.pixel) { pxPanel(ctx, x, y, s, s, { frame: hov ? PAL.gold : '#d8ccb8', fill: hov ? '#3a1418' : PAL.table }); ctx.fillStyle = PAL.cream; ctx.fillRect(x + 12, y + 12, 4, 16); ctx.fillRect(x + 24, y + 12, 4, 16); const hit = hov && P.clicked; if (hit) P.clicked = false; return hit; }
  ctx.fillStyle = hov ? 'rgba(120,28,30,0.9)' : 'rgba(14,9,11,0.7)'; ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = '#d8c3ae'; ctx.lineWidth = 1.2; ctx.strokeRect(x + 3.5, y + 3.5, s - 7, s - 7);
  ctx.fillStyle = '#ead9c6'; ctx.fillRect(x + 14, y + 12, 4, 16); ctx.fillRect(x + 22, y + 12, 4, 16);
  const hit = hov && P.clicked; if (hit) P.clicked = false; return hit;
}
