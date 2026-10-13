// «Память о сыне» — вторая игра на память после каждого поля, у костра. Три вида по очереди:
//  lyre      — «Плач»: повторить напев лиры (последовательная, слуховая память);
//  formation — «Строй»: где стояли щиты товарищей в фаланге (пространственная память);
//  details   — «Приметы»: короткое воспоминание, потом вопросы о деталях (зрительная память).
// Провала нет: ошибки только уменьшают награду. Награда — осколки памяти и дар богов.
import { SONS } from './data.js';
import { img, W, H, text, wrap, button, comicBox, drawCam, drawBadge, drawGlyph, drawPost, Fog, STYLE } from '../art/gfx.js';
import { pxLyre, pxDisc, pxRing, pxIcon, pxFrame, PAL } from '../art/pixel.js';
import { sfx, lyre, setAmbient } from '../engine/audio.js';
import { setMood } from '../engine/score.js';
import { rand, pick, shuffle, TAU, clamp } from '../engine/util.js';

const LYRE_X = i => 480 - 2 * 62 + i * 62, LY0 = 172, LY1 = 382;
const STR_COL = ['#d8574a', '#e0a526', '#9bc06a', '#5aa0d8', '#b07ad8'];
const GLYPHS = ['eye', 'horns', 'wave', 'sun', 'snake', 'moon', 'star', 'arrow'];
const CRESTS = ['#c8102e', '#efe6d2', '#2f6db5', '#e0a526', '#3f9a52', '#7e3fa0', '#b8632f', '#c9ced6'];
const ITEMS = ['щит со сколом', 'уздечка', 'весло', 'медный рог', 'сумка с травами', 'лира', 'царский перстень', 'лук'];

export function createMemento(app) {
  let M = null;
  const fog = new Fog();
  function seqOf(n) { const s = []; for (let i = 0; i < n; i++) { let v; do v = Math.floor(rand(5)); while (v === s[i - 1]); s.push(v); } return s; }
  const scene = {
    get M() { return M; },
    enter(game, { kind, son }) {
      const S = SONS[son], idx = son;
      M = { kind, son: S, idx, t: 0, phase: 'intro', errors: 0, round: 0, done: false, msg: '', flash: [-1, 0] };
      fog.amount = 0.35;
      setMood('memory'); setAmbient({ rain: 0, night: 0.3, fire: 0.35, wind: 0.1, howls: 0 });
      if (kind === 'lyre') Object.assign(M, { len: 3 + Math.floor(idx / 2), seq: [], input: [], show: false, showT: 0, rounds: 2 });
      if (kind === 'formation') Object.assign(M, { rounds: 3, lit: [], picks: [], show: false, showT: 0, size: 4 });
      if (kind === 'details') Object.assign(M, { qs: makeQuestions(S, idx), qi: 0, answered: -1, ansT: 0, showT: 0 });
    },
    update(dt) {
      if (!M) return; const inp = app.inp, P = inp.pointer;
      M.t += dt; fog.update(dt); M.flash[1] = Math.max(0, M.flash[1] - dt);
      if (M.phase === 'intro') { if (M.t > 3.2 || (M.t > 0.6 && P.pressed)) { M.phase = 'play'; M.t = 0; startRound(); } inp.endStep(); return; }
      if (M.phase === 'play') {
        if (M.kind === 'lyre') updLyre(dt, P);
        if (M.kind === 'formation') updFormation(dt, P);
        if (M.kind === 'details') updDetails(dt, P);
      }
      inp.endStep();
    },
    draw(ctx) { if (M) drawM(ctx); },
    toText: () => M ? { scene: 'memento', kind: M.kind, phase: M.phase, round: M.round, errors: M.errors, seq: M.seq, lit: M.lit, q: M.qs?.[M.qi]?.answer } : {},
  };

  function startRound() {
    M.round++;
    if (M.kind === 'lyre') { M.seq = seqOf(M.len + M.round - 1); M.input = []; M.show = true; M.showT = 0; M.lastK = -1; }
    if (M.kind === 'formation') { const n = 3 + M.round; M.lit = shuffle([...Array(16).keys()]).slice(0, n); M.picks = []; M.show = true; M.showT = 0; }
  }
  function finish() {
    if (M.phase === 'result') return;
    M.phase = 'result'; M.t = 0;
    const shards = Math.max(2, 8 - M.errors * 2); M.shards = shards;
    app.save.shards = (app.save.shards || 0) + shards;
    if (M.errors === 0) { app.save.gifts[pick(['gaze', 'flash', 'amph'])]++; M.gift = true; if (M.kind === 'lyre') app.ach('lament'); }
    app.persist(); sfx('sacred', { vol: 0.4 });
  }

  // ---- Плач
  function updLyre(dt, P) {
    M.showT += dt;
    if (M.show) {
      const step = 0.72, k = Math.floor((M.showT - 0.9) / step);
      if (k >= 0 && k < M.seq.length && k !== M.lastK) { M.lastK = k; lyre(M.seq[k]); M.flash = [M.seq[k], 0.45]; }
      if (M.showT > 0.9 + M.seq.length * step + 0.3) { M.show = false; M.input = []; }
    } else if (P.pressed) {
      const s = lyreString(P.x, P.y); if (s < 0) return;
      lyre(s); M.flash = [s, 0.3]; M.input.push(s);
      const j = M.input.length - 1;
      if (M.input[j] !== M.seq[j]) { M.errors++; sfx('harp_bad', { vol: 0.45 }); M.msg = 'Не так… послушай ещё раз.'; M.show = true; M.showT = 0; M.lastK = -1; M.input = []; if (M.errors >= 4) finish(); }
      else if (M.input.length === M.seq.length) { sfx('harp_ok', { vol: 0.5 }); M.msg = ''; if (M.round >= M.rounds) finish(); else { M.msg = 'Ещё один напев — длиннее.'; setTimeout(() => M && M.phase === 'play' && startRound(), 900); M.show = true; M.showT = -5; } }
    }
  }
  function lyreString(x, y) { if (y < LY0 - 10 || y > LY1 + 20) return -1; for (let i = 0; i < 5; i++) if (Math.abs(x - LYRE_X(i)) < 29) return i; return -1; }

  // ---- Строй: сетка 4×4 щитов фаланги
  const CELL = (i) => ({ x: 480 - 2 * 74 + (i % 4) * 74 + 37, y: 150 + Math.floor(i / 4) * 74 + 37 });
  function updFormation(dt, P) {
    M.showT += dt;
    if (M.show) { if (M.showT > 2.2 + M.round * 0.3) { M.show = false; sfx('flip', { vol: 0.4 }); } return; }
    if (!P.pressed) return;
    for (let i = 0; i < 16; i++) {
      const c = CELL(i); if (Math.abs(P.x - c.x) < 33 && Math.abs(P.y - c.y) < 33 && !M.picks.includes(i)) {
        M.picks.push(i);
        if (M.lit.includes(i)) { sfx('draw', { vol: 0.35 }); }
        else { M.errors++; sfx('miss', { vol: 0.5 }); M.wrong = { i, t: 0.6 }; }
        const good = M.picks.filter(p => M.lit.includes(p)).length;
        if (good === M.lit.length || M.picks.length - good >= 3) {
          M.msg = good === M.lit.length ? 'Так они и стояли — плечом к плечу.' : 'Память подвела… Но он был там.';
          if (M.round >= M.rounds) setTimeout(() => M && finish(), 900); else setTimeout(() => M && M.phase === 'play' && startRound(), 1100);
          M.show = 'answer';
        }
        break;
      }
    }
  }

  // ---- Приметы: воспоминание (герб, гребень, предмет), потом 3 вопроса
  function makeQuestions(S, idx) {
    const choose = (right, pool) => shuffle([right, ...shuffle(pool.filter(x => x !== right)).slice(0, 2)]);
    return [
      { q: 'Какой знак был на его щите?', kind: 'glyph', opts: choose(S.glyph, GLYPHS), answer: S.glyph },
      { q: 'Какого цвета был гребень?', kind: 'crest', opts: choose(S.crest, CRESTS), answer: S.crest },
      { q: 'Что он держал в руках?', kind: 'item', opts: choose(S.item || ITEMS[idx], ITEMS), answer: S.item || ITEMS[idx] },
    ];
  }
  function updDetails(dt, P) {
    M.showT += dt;
    if (M.showT < 4.5) return; // смотрим воспоминание
    if (M.answered >= 0) { M.ansT += dt; if (M.ansT > 1.1) { M.answered = -1; M.ansT = 0; M.qi++; if (M.qi >= M.qs.length) finish(); } return; }
    if (!P.pressed) return;
    const Q = M.qs[M.qi];
    Q.opts.forEach((o, i) => { const x = 480 + (i - 1) * 190, y = 330; if (Math.abs(P.x - x) < 85 && Math.abs(P.y - y) < 70) { M.answered = i; if (o !== Q.answer) { M.errors++; sfx('harp_bad', { vol: 0.4 }); } else sfx('harp_ok', { vol: 0.4 }); } });
  }

  // ---------------------------------------------------------------- отрисовка
  function drawM(ctx) {
    ctx.fillStyle = '#070405'; ctx.fillRect(0, 0, W, H);
    const bg = img('c_pyre'); if (bg) { ctx.globalAlpha = 0.45; drawCam(ctx, bg, [0.5, 0.55, 1.05 + M.t * 0.002]); ctx.globalAlpha = 1; }
    if (!STYLE.pixel) { const g = ctx.createRadialGradient(480, 470, 10, 480, 470, 420); g.addColorStop(0, 'rgba(255,140,60,0.22)'); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    fog.draw(ctx, 300);
    const title = { lyre: 'Плач', formation: 'Строй', details: 'Приметы' }[M.kind];
    text(ctx, title, W / 2, 46, { size: 34, sc: true, spacing: 3 });
    text(ctx, 'Память о сыне: ' + M.son.name, W / 2, 80, { size: 18, color: '#d9c2a8' });
    if (M.phase === 'intro') {
      const hint = { lyre: 'Лира помнит его песни. Послушай напев и повтори его по струнам.', formation: 'Вспомни строй: где стояли щиты его товарищей? Смотри — и укажи.', details: 'Закрой глаза — и вспомни его. Потом ответь, каким он был.' }[M.kind];
      comicBox(ctx, W / 2 - 300, 220, 600, 100); wrap(ctx, hint, 540, 20).forEach((l, i) => text(ctx, l, W / 2, 255 + i * 26, { size: 20 }));
      drawBadge(ctx, M.son, W / 2, 400, 40);
    } else if (M.phase === 'play') {
      if (M.kind === 'lyre') drawLyre(ctx);
      if (M.kind === 'formation') drawFormation(ctx);
      if (M.kind === 'details') drawDetails(ctx);
      if (M.msg) text(ctx, M.msg, W / 2, 506, { size: 18, color: '#ffe0b0' });
    } else if (M.phase === 'result') {
      comicBox(ctx, W / 2 - 230, 170, 460, 210);
      text(ctx, M.errors === 0 ? 'Ты помнишь его.' : M.errors < 3 ? 'Почти всё помнишь.' : 'Память тускнеет… но он с тобой.', W / 2, 210, { size: 24, sc: true });
      drawBadge(ctx, M.son, W / 2, 262, 26);
      text(ctx, `Осколки памяти: +${M.shards}` + (M.gift ? '   Дар богов: +1' : ''), W / 2, 312, { size: 18, color: '#ffe0a8' });
      if (M.t > 0.5 && button(ctx, app.inp, W / 2 - 110, 400, 220, 52, 'Дальше', { key: 'Enter' })) app.next();
    }
    drawPost(ctx, { tint: '#6b3a48', tintA: 0.12 });
  }
  function drawLyre(ctx) {
    text(ctx, M.show ? 'Слушай напев…' : `Повтори: ${M.input.length} / ${M.seq.length}`, W / 2, 120, { size: 18, color: '#d9c2a8' });
    if (STYLE.pixel) { const P = app.inp.pointer, xs = [0, 1, 2, 3, 4].map(LYRE_X); pxLyre(ctx, { xs, y0: LY0, y1: LY1, lit: M.flash[0], litK: M.flash[1], hover: M.show ? -1 : xs.findIndex(x => Math.abs(P.x - x) < 29 && P.y > LY0 - 10 && P.y < LY1 + 20), cols: STR_COL, t: M.t }); return; }
    ctx.save(); ctx.lineCap = 'round';
    const spL = img('spr_lyre');
    if (spL) { const lw = 380, lh = lw * spL.height / spL.width; ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(480, 118 + lh, 150, 14, 0, 0, TAU); ctx.fill(); ctx.drawImage(spL, 480 - lw / 2, 118, lw, lh); }
    else {
    const xl = LYRE_X(0) - 46, xr = LYRE_X(4) + 46;
    for (const [side, x0] of [[-1, xl], [1, xr]]) {
      for (const [lw, col] of [[16, '#5a3a1e'], [9, '#c9954f']]) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x0 - side * 6, LY1 + 26); ctx.bezierCurveTo(x0 + side * 46, LY1 - 40, x0 + side * 54, LY0 + 40, x0 + side * 4, LY0 - 34); ctx.stroke(); }
      ctx.fillStyle = '#e8c27a'; ctx.beginPath(); ctx.arc(x0 + side * 4, LY0 - 36, 7, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#8a5a2c'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(xl - 6, LY0 - 14); ctx.lineTo(xr + 6, LY0 - 14); ctx.stroke();
    const bx = 480, by = LY1 + 30, gb = ctx.createRadialGradient(bx, by - 10, 10, bx, by, 150); gb.addColorStop(0, '#7a5230'); gb.addColorStop(1, '#2e1c10');
    ctx.fillStyle = gb; ctx.beginPath(); ctx.ellipse(bx, by, 150, 34, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(230,190,120,0.35)'; ctx.lineWidth = 1.5; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(bx + k * 48, by, 22, 20, 0, 0, TAU); ctx.stroke(); }
    }
    for (let i = 0; i < 5; i++) {
      const lit = M.flash[0] === i && M.flash[1] > 0, x = LYRE_X(i), vib = lit ? Math.sin(M.t * 80) * 3 * M.flash[1] : 0;
      const P = app.inp.pointer; if (!M.show && Math.abs(P.x - x) < 29 && P.y > LY0 - 10 && P.y < LY1 + 20) { ctx.fillStyle = 'rgba(255,220,160,0.10)'; ctx.fillRect(x - 28, LY0 - 10, 56, LY1 - LY0 + 30); }
      ctx.strokeStyle = lit ? '#fff2c0' : '#e3d6bc'; ctx.lineWidth = lit ? 3.5 : 2; ctx.shadowColor = lit ? STR_COL[i] : 'transparent'; ctx.shadowBlur = lit ? 22 : 0;
      ctx.beginPath(); ctx.moveTo(x, LY0 - 14); ctx.quadraticCurveTo(x + vib, (LY0 + LY1) / 2, x + (x - 480) * -0.12, LY1 + 22); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = STR_COL[i]; ctx.beginPath(); ctx.arc(x, LY0 - 14, lit ? 9 : 6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function drawFormation(ctx) {
    text(ctx, M.show === true ? 'Запоминай строй…' : M.show === 'answer' ? '' : `Укажи щиты товарищей: ${M.picks.filter(p => M.lit.includes(p)).length} / ${M.lit.length}`, W / 2, 120, { size: 18, color: '#d9c2a8' });
    const shield = img('card_shield');
    for (let i = 0; i < 16; i++) {
      const c = CELL(i), lit = M.lit.includes(i), picked = M.picks.includes(i);
      const showLit = M.show === true || M.show === 'answer';
      if (STYLE.pixel) { // щит фаланги: тёмный круг с ободом; товарищ — красный щит, золотой обод, знак сына; ошибка — красный крест
        const on = (showLit && lit) || (picked && lit);
        pxDisc(ctx, c.x, c.y + 4, 32, 'rgba(0,0,0,0.4)'); pxDisc(ctx, c.x, c.y, 32, PAL.ink); pxDisc(ctx, c.x, c.y, 28, on ? '#7a1418' : '#2a1e1c'); pxRing(ctx, c.x, c.y, 28, on ? '#d8b06a' : '#5c4636'); if (!on) { pxDisc(ctx, c.x, c.y, 8, '#5c4636'); pxDisc(ctx, c.x - 4, c.y - 4, 4, '#7a6050'); }
        if (on) drawGlyph(ctx, M.son.glyph, c.x, c.y, 13, '#f2e2c8');
        if (picked && !lit) pxIcon(ctx, 'cross', c.x, c.y, 4, { r: '#ff6a50' });
        continue;
      }
      ctx.save(); ctx.translate(c.x, c.y);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(0, 4, 31, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a1e1c'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill(); ctx.strokeStyle = '#5c4636'; ctx.lineWidth = 3; ctx.stroke();
      if ((showLit && lit) || (picked && lit)) { ctx.fillStyle = '#7a1418'; ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.fill(); ctx.strokeStyle = '#d8b06a'; ctx.lineWidth = 3; ctx.stroke(); drawGlyph(ctx, M.son.glyph, 0, 0, 13, '#f2e2c8'); }
      if (picked && !lit) { ctx.strokeStyle = '#ff6a50'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(14, 14); ctx.moveTo(14, -14); ctx.lineTo(-14, 14); ctx.stroke(); }
      ctx.restore();
    }
    text(ctx, `Строй ${M.round} из ${M.rounds}`, W / 2, 470, { size: 16, color: '#a8927f' });
  }
  function drawDetails(ctx) {
    if (M.showT < 4.5) {
      const a = Math.min(1, M.showT * 2, (4.5 - M.showT) * 2);
      ctx.save(); ctx.globalAlpha = a;
      comicBox(ctx, W / 2 - 250, 120, 500, 330);
      drawBadge(ctx, M.son, W / 2, 230, 70);
      text(ctx, M.son.name, W / 2, 330, { size: 30, sc: true });
      text(ctx, 'в руках: ' + (M.son.item || ITEMS[M.idx]), W / 2, 368, { size: 20, color: '#ffe0b0' });
      text(ctx, 'Запомни его…', W / 2, 410, { size: 17, color: '#bfa996' });
      ctx.restore(); return;
    }
    if (M.qi >= M.qs.length) return;
    const Q = M.qs[M.qi];
    text(ctx, Q.q, W / 2, 170, { size: 26, sc: true });
    text(ctx, `Вопрос ${M.qi + 1} из ${M.qs.length}`, W / 2, 205, { size: 15, color: '#a8927f' });
    Q.opts.forEach((o, i) => {
      const x = 480 + (i - 1) * 190, y = 330, P = app.inp.pointer, hov = M.answered < 0 && Math.abs(P.x - x) < 85 && Math.abs(P.y - y) < 70;
      let border = hov ? '#ffd9b0' : '#8a7262';
      if (M.answered >= 0) border = o === Q.answer ? '#8fdc7a' : (i === M.answered ? '#ff6a50' : '#4a3a32');
      comicBox(ctx, x - 85, y - 70, 170, 140, 0.9); if (STYLE.pixel) pxFrame(ctx, x - 84, y - 68, 168, 136, border); else { ctx.strokeStyle = border; ctx.lineWidth = 3; ctx.strokeRect(x - 82, y - 67, 164, 134); }
      if (STYLE.pixel && Q.kind === 'glyph') { pxDisc(ctx, x, y, 40, '#1a1214'); drawGlyph(ctx, o, x, y, 24); }
      else if (STYLE.pixel && Q.kind === 'crest') pxIcon(ctx, ['....cccccc..', '..cccccccccc', '.ccccccccccc', 'ccccc....ccc', 'cccc......cc', 'ccc.........', '.....kk.....', '.....kk.....', '.....kk.....'], x, y, 8, { c: o, k: '#5c4636' });
      else if (Q.kind === 'glyph') { ctx.fillStyle = '#1a1214'; ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU); ctx.fill(); drawGlyph(ctx, o, x, y, 24); }
      else if (Q.kind === 'crest') { ctx.fillStyle = o; ctx.beginPath(); ctx.ellipse(x, y, 52, 22, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 6, y, 12, 30); }
      if (Q.kind === 'item') wrap(ctx, o, 150, 20).forEach((l, k) => text(ctx, l, x, y - 8 + k * 24, { size: 20 }));
    });
  }
  return scene;
}
