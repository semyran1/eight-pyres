// Ввод: мышь/тач (клик, удержание, траектория для свайпов) + клавиатура.
// pressed — для логики (живёт один шаг симуляции); clicked — для кнопок, которые проверяются при отрисовке
// (живёт до конца кадра: шагов логики в кадре бывает несколько, они стёрли бы клик до отрисовки — урок Blood).
export function createInput(game) {
  const keys = new Set(), pressed = new Set(), uiPressed = new Set();
  const inp = {
    pointer: { x: -99, y: -99, down: false, pressed: false, released: false, clicked: false, path: [] },
    isTouch: false,
  };
  addEventListener('keydown', e => {
    if (!keys.has(e.code)) { pressed.add(e.code); uiPressed.add(e.code); }
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const c = game.canvas, P = inp.pointer;
  c.addEventListener('pointerdown', e => {
    c.setPointerCapture?.(e.pointerId);
    const p = game.toWorld(e.clientX, e.clientY);
    inp.isTouch = inp.isTouch || e.pointerType === 'touch';
    P.x = p.x; P.y = p.y; P.down = true; P.pressed = true; P.clicked = true;
    P.path = [{ x: p.x, y: p.y, t: performance.now() }];
    e.preventDefault();
  });
  c.addEventListener('pointermove', e => {
    const p = game.toWorld(e.clientX, e.clientY);
    P.x = p.x; P.y = p.y;
    if (P.down) { P.path.push({ x: p.x, y: p.y, t: performance.now() }); if (P.path.length > 40) P.path.shift(); }
  });
  const up = () => { P.down = false; P.released = true; };
  c.addEventListener('pointerup', up);
  c.addEventListener('pointercancel', up);
  c.addEventListener('contextmenu', e => e.preventDefault());

  inp.down = code => keys.has(code);
  inp.hit = code => pressed.has(code);
  inp.uiHit = code => uiPressed.has(code);
  inp.endFrame = () => { uiPressed.clear(); P.clicked = false; };
  inp.endStep = () => { pressed.clear(); P.pressed = false; P.released = false; };
  // программный клик (для бота и тестов)
  inp.fakeClick = (x, y) => { P.x = x; P.y = y; P.pressed = true; P.clicked = true; P.released = true; };
  return inp;
}
