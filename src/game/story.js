// Сюжетные сцены: кадры комикса автора и новые кадры в его стиле. Камера медленно ведёт кадр (k0 → k1),
// текст печатается в рамке «как в комиксе» (белая двойная обводка из оригинала), звуки по таймкодам.
// Клик — дописать текст / следующий кадр; «Пропустить» — вся сцена.
import { STORIES, WHO, SONS } from './data.js';
import { whenImages, img, W, H, text, wrap, comicBox, button, drawCam, drawTall, Rain, Fog, boltPath, drawBolt, drawSky, drawConstellation, drawPost, STYLE, measure } from '../art/gfx.js';
import { pxFrame, pxPanel } from '../art/pixel.js';
import { sfx, setAmbient, playMusic } from '../engine/audio.js';
import { setMood } from '../engine/score.js';
import { STORY_MOOD } from './data.js';
import { tr } from './i18n.js';
import { ease, lerp, rand } from '../engine/util.js';

export function createStory(app) {
  let st = null;
  const rain = new Rain(200), fog = new Fog();

  function startPanel(i) {
    st.i = i; st.t = 0; st.fired = new Set();
    const p = st.panels[i]; if (!p) return;
    if (p.amb) setAmbient(p.amb, 1.2);
    if (p.reveal) { app.save.nameRevealed = true; app.persist(); app.updateName?.(); }
    st.bolt = null;
  }
  const scene = {
    enter(game, { id, onDone, music }) {
      st = { id, panels: STORIES[id] || [], onDone, i: 0, t: 0, fade: 0, done: false, bolt: null, shake: 0, flash: 0, wait: true };
      const need = st.panels.flatMap(p => [p.img, ...(p.page || []).map(q => q.img)]).filter(Boolean);
      whenImages(need).then(() => { if (st) st.wait = false; });
      playMusic(null); setMood(STORY_MOOD[id] || 'story');
      startPanel(0);
    },
    update(dt) {
      if (!st || st.done) return;
      if (st.wait) { app.inp.endStep(); return; }
      const p = st.panels[st.i], inp = app.inp;
      st.t += dt; rain.update(dt); fog.update(dt); st.shake = Math.max(0, st.shake - dt); st.flash = Math.max(0, st.flash - dt * 2);
      if (!p) return finish();
      for (const [tt, name, vol] of p.sfx || []) if (st.t >= tt && !st.fired.has(name + tt)) { st.fired.add(name + tt); sfx(name, { vol: vol ?? 0.7 }); }
      const fx = p.fx || [];
      rain.amount = fx.includes('rain') ? 0.8 : 0; fog.amount = fx.includes('fog') ? 0.7 : 0;
      if (fx.includes('bolt') && !st.bolt && st.t > 0.1) { st.bolt = { b: boltPath(W / 2 + rand(-40, 40), -10, W / 2, H * 0.62, 24), t: 0 }; st.flash = 1; }
      if (fx.includes('shake') && st.t < 0.12) st.shake = 0.6;
      if (st.bolt) st.bolt.t += dt;
      if (p.page) { updatePage(p, inp); inp.endStep(); return; }
      const textDone = !p.text || st.t * 40 >= p.text.length;
      if (inp.pointer.pressed && !inSkip(inp.pointer)) { if (!textDone) st.t = p.text.length / 40 + 0.01; else next(); }
      else if (inp.hit('Space') || inp.hit('Enter')) { if (!textDone) st.t = p.text.length / 40 + 0.01; else next(); }
      else if (st.t > p.dur + (p.text ? p.text.length / 60 : 0)) next();
      inp.endStep();
    },
    draw(ctx) {
      if (!st) return;
      const p = st.panels[st.i]; if (!p) return;
      const k = ease.inOutSine(Math.min(1, st.t / Math.max(1, p.dur)));
      ctx.save();
      if (st.shake > 0) ctx.translate(Math.sin(st.t * 90) * st.shake * 9, Math.cos(st.t * 70) * st.shake * 7);
      ctx.fillStyle = '#060304'; ctx.fillRect(0, 0, W, H);
      if (p.img) {
        const k0 = p.k0 || [0.5, 0.5, 1], k1 = p.k1 || k0, cam = [lerp(k0[0], k1[0], k), lerp(k0[1], k1[1], k), lerp(k0[2], k1[2], k)];
        if (p.tall) drawTall(ctx, img(p.img), cam); else drawCam(ctx, img(p.img), cam);
      }
      if (p.page) drawPage(ctx, p);
      if (p.sky) {
        drawSky(ctx, st.t);
        const lit = [true, true, true, true, true, true, true, true, st.t > 1.2];
        drawConstellation(ctx, st.t, lit, { lines: p.hercules ? Math.min(1, st.t / 3) : 0, s: 1.25, y: 20 });
      }
      if (st.bolt && st.bolt.t < 0.5) drawBolt(ctx, st.bolt.b, 1 - st.bolt.t / 0.5);
      if (st.flash > 0) { ctx.fillStyle = `rgba(230,220,255,${st.flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
      fog.draw(ctx, 250); rain.draw(ctx);
      ctx.restore();
      // кинорамка: чёрные полосы сверху и снизу на кадрах-иллюстрациях
      if (p.img && !p.tall) { const lb = 26 * Math.min(1, st.t * 2); ctx.fillStyle = '#050203'; ctx.fillRect(0, 0, W, lb); ctx.fillRect(0, H - lb, W, lb); }
      // титул главы
      if (p.chapter) {
        const a = Math.min(1, st.t * 1.5, (p.dur - st.t) * 1.5);
        ctx.globalAlpha = Math.max(0, a);
        text(ctx, p.chapter, W / 2, H / 2 - 40, { size: 24, sc: true, color: '#b89a82', spacing: 6 });
        text(ctx, p.title, W / 2, H / 2 + 10, { size: 54, sc: true, color: '#efdcc4', spacing: 3 });
        ctx.fillStyle = '#7a1f22'; ctx.fillRect(W / 2 - 60, H / 2 + 50, 120, 2);
        ctx.globalAlpha = 1;
      }
      if (p.credits) drawCredits(ctx, st.t);
      if (p.text) drawCaption(ctx, p);
      // затемнение входа в кадр
      const fin = Math.max(0, 1 - st.t * 2.2); if (fin > 0) { ctx.fillStyle = `rgba(6,3,4,${fin})`; ctx.fillRect(0, 0, W, H); }
      drawPost(ctx, { tint: '#6b3a48', tintA: 0.12 });
      if (button(ctx, app.inp, W - 152, H - 50, 140, 38, 'Пропустить', { size: 16, key: 'Escape' })) finish();
    },
    toText: () => ({ scene: 'story', id: st?.id, panel: st?.i, of: st?.panels.length }),
  };
  function inSkip(P) { return P.x > W - 152 && P.y > H - 50; }

  // ---- Страница комикса: панели появляются по очереди, внутри — медленная камера, облачка с хвостиком
  // p.page = [{ img, r: [x, y, w, h], k0, k1, t, cap: { text, t }, bubbles: [{ t, text, who, name, x, y, tail: [x, y], w }] }]
  function pageEnd(p) { let e = 0; for (const pn of p.page) { e = Math.max(e, pn.t || 0); for (const b of pn.bubbles || []) e = Math.max(e, (b.t ?? pn.t ?? 0) + b.text.length / 34); if (pn.cap) e = Math.max(e, (pn.cap.t ?? pn.t ?? 0) + pn.cap.text.length / 34); } return e + 0.6; }
  function updatePage(p, inp) {
    const end = pageEnd(p);
    for (const pn of p.page) if (pn.sfx && !st.fired.has(pn.img + 'sfx') && st.t >= (pn.t || 0)) { st.fired.add(pn.img + 'sfx'); sfx(pn.sfx[0], { vol: pn.sfx[1] ?? 0.6 }); }
    const click = (inp.pointer.pressed && !inSkip(inp.pointer)) || inp.hit('Space') || inp.hit('Enter');
    if (click) { if (st.t < end) st.t = end; else next(); }
    else if (st.t > end + (p.hold ?? 3.5)) next();
  }
  function drawPage(ctx, p) {
    // бумага страницы
    ctx.fillStyle = '#0d0809'; ctx.fillRect(0, 0, W, H);
    for (const pn of p.page) {
      const t0 = pn.t || 0; if (st.t < t0) continue;
      const a = Math.min(1, (st.t - t0) * 2.5), [x, y, w, h] = pn.r;
      const k = Math.min(1, (st.t - t0) / 9), k0 = pn.k0 || [0.5, 0.5, 1.1], k1 = pn.k1 || [0.5, 0.5, 1.2];
      const cam = [lerp(k0[0], k1[0], k), lerp(k0[1], k1[1], k), lerp(k0[2], k1[2], k)];
      ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * 14);
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.save(); ctx.clip();
      drawCam(ctx, img(pn.img), cam, x, y, w, h);
      if (pn.rain) { ctx.globalAlpha = a * 0.8; rain.draw(ctx); }
      ctx.restore();
      if (STYLE.pixel) pxFrame(ctx, x, y, w, h, '#efe4d6');   // рамка кадра — 1 пиксель арта
      else { ctx.strokeStyle = '#efe4d6'; ctx.lineWidth = 2.5; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.strokeStyle = '#0d0809'; ctx.lineWidth = 1; ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9); }
      ctx.restore();
      if (pn.cap && st.t >= (pn.cap.t ?? t0)) drawCap(ctx, pn.cap, x, y, w);
      for (const b of pn.bubbles || []) if (st.t >= (b.t ?? t0)) drawBubble(ctx, b);
    }
  }
  function drawCap(ctx, c, x, y, w) {
    const shown = tr(c.text).slice(0, Math.floor((st.t - (c.t ?? 0)) * 34) + 1);
    const lines = wrap(ctx, c.text, Math.min(w - 40, 360), 17, 600), bw = Math.min(w - 20, 380), bh = lines.length * 21 + 16;
    if (STYLE.pixel) pxPanel(ctx, x + 8, y + 8, bw, bh + 4, { fill: '#e9dcc6', frame: '#1a1012', shade: 'rgba(0,0,0,0.15)' });
    else { ctx.save(); ctx.fillStyle = '#e9dcc6'; ctx.fillRect(x + 8, y + 8, bw, bh); ctx.strokeStyle = '#1a1012'; ctx.lineWidth = 2; ctx.strokeRect(x + 8, y + 8, bw, bh); ctx.restore(); }
    wrap(ctx, shown, Math.min(w - 40, 360), 17, 600).forEach((l, i) => text(ctx, l, x + 18, y + 26 + i * 21, { size: 17, align: 'left', color: '#2a1a16', shadow: false }));
  }
  function drawBubble(ctx, b) {
    const who = WHO[b.who] || WHO.narr, tt = st.t - (b.t ?? 0), pop = Math.min(1, tt * 6);
    const bw = Math.min(b.w || 260, 300), lines = wrap(ctx, b.text, bw - 24, 16, 600), bh = lines.length * 19 + (b.name || who.name ? 30 : 16);
    ctx.save(); ctx.globalAlpha = pop; ctx.translate(b.x, b.y); ctx.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop);
    const x = -bw / 2, y = -bh / 2;
    ctx.fillStyle = '#f4ece0'; ctx.strokeStyle = '#120a0b'; ctx.lineWidth = 2.5;
    if (STYLE.pixel) { // пузырь реплики: светлая панель в пиксель, хвост — ступеньками к говорящему
      pxPanel(ctx, x, y, bw, bh, { fill: '#f4ece0', frame: '#120a0b', shade: 'rgba(0,0,0,0.12)' });
      if (b.tail) { const tx = b.tail[0] - b.x, ty = b.tail[1] - b.y, bx = Math.max(x + 24, Math.min(x + bw - 24, tx * 0.3)), by = ty > 0 ? y + bh - 4 : y + 4, n = Math.max(1, Math.round(Math.abs(ty - by) / 8)); for (let i = 0; i <= n; i++) { const k = i / n, w = Math.max(4, Math.round((1 - k) * 4) * 4); ctx.fillStyle = '#120a0b'; ctx.fillRect(Math.round((bx + (tx - bx) * k) / 4) * 4 - w / 2 - 4, Math.round((by + (ty - by) * k) / 4) * 4, w + 8, 4); ctx.fillStyle = '#f4ece0'; ctx.fillRect(Math.round((bx + (tx - bx) * k) / 4) * 4 - w / 2, Math.round((by + (ty - by) * k) / 4) * 4, w, 4); } }
    } else {
    ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 18);
    if (b.tail) { const tx = b.tail[0] - b.x, ty = b.tail[1] - b.y; const bx = Math.max(x + 24, Math.min(x + bw - 24, tx * 0.3)); const by = ty > 0 ? y + bh : y; ctx.moveTo(bx - 10, by); ctx.lineTo(tx, ty); ctx.lineTo(bx + 10, by); }
    ctx.fill(); ctx.stroke();
    if (b.tail) { const tx = b.tail[0] - b.x, ty = b.tail[1] - b.y; const bx = Math.max(x + 24, Math.min(x + bw - 24, tx * 0.3)); const by = ty > 0 ? y + bh : y; ctx.fillStyle = '#f4ece0'; ctx.fillRect(bx - 9, by - (ty > 0 ? 3 : -1), 18, 3); }
    }
    let yy = y + 17; const nm = b.name || who.name;
    if (nm) { text(ctx, nm, 0, yy, { size: 12, sc: true, color: '#7a2a24', spacing: 1.5, shadow: false }); yy += 16; }
    const shown = tr(b.text).slice(0, Math.floor(tt * 34) + 1);
    wrap(ctx, shown, bw - 24, 16, 600).forEach((l, i) => text(ctx, l, 0, yy + i * 19, { size: 16, color: '#1a1012', shadow: false }));
    ctx.restore();
  }
  function next() { if (st.i + 1 >= st.panels.length) finish(); else startPanel(st.i + 1); }
  function finish() { if (st.done) return; st.done = true; const f = st.onDone; f && f(); }

  function drawCaption(ctx, p) {
    const who = WHO[p.who] || WHO.narr;
    const shown = tr(p.text).slice(0, Math.floor(st.t * 40));
    const isLine = p.who && p.who !== 'narr';
    const size = isLine ? 24 : 21;
    const lines = wrap(ctx, p.text, 640, size, 600);
    const bw = Math.min(720, Math.max(...lines.map(l => { if (STYLE.pixel) return measure(ctx, l, size); ctx.font = `600 ${size}px "Cormorant Garamond", serif`; return ctx.measureText(l).width; })) + 70);
    const bh = lines.length * size * 1.25 + ((p.name || who.name) ? 46 : 32);
    const x = W / 2 - bw / 2, y = isLine || p.capLow ? H - bh - 70 : 34;
    comicBox(ctx, x, y, bw, bh, Math.min(1, st.t * 3));
    let yy = y + 26;
    const nm = p.name || who.name;
    if (nm) { text(ctx, nm, W / 2, yy, { size: 15, sc: true, color: who.color, spacing: 3 }); yy += 22; }
    const sl = wrap(ctx, shown, 640, size, 600);
    sl.forEach((l, i) => text(ctx, l, W / 2, yy + i * size * 1.25, { size, color: isLine ? '#f4e6d4' : '#dccbbb', italic: !isLine }));
  }
  function drawCredits(ctx, t) {
    ctx.fillStyle = '#060304'; ctx.fillRect(0, 0, W, H);
    drawSky(ctx, t);
    drawConstellation(ctx, t, Array(9).fill(true), { lines: 1, s: 0.9, y: -40 });
    const a = Math.min(1, t);
    ctx.globalAlpha = a;
    text(ctx, 'Восемь костров', W / 2, 330, { size: 46, sc: true, spacing: 3 });
    text(ctx, SONS.map(s => s.name).join(' · '), W / 2, 372, { size: 17, color: '#cdb6a0' });
    text(ctx, 'Игра ApolloGames. По мотивам мифа об Электрионе, царе Микен.', W / 2, 420, { size: 17, color: '#a8927f' });
    text(ctx, 'Арт и звуки — из прототипов на Construct 3; код — ремейк 2026.', W / 2, 446, { size: 15, color: '#8a7768' });
    ctx.globalAlpha = 1;
  }
  return scene;
}
