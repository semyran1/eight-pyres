// Локализация: все строки игры пишутся по-русски, перевод подставляется при отрисовке (gfx.text / wrap).
// Ключ — русская строка; для строк с подстановкой ключ содержит {n} (числа, имена) и сопоставляется шаблоном.
let EN = null, patterns = [];
const cache = new Map();
export const LANG = { v: 'ru' };

export async function setLang(lang) {
  LANG.v = lang === 'en' ? 'en' : 'ru'; cache.clear();
  if (LANG.v === 'en' && !EN) {
    try {
      EN = (await import('./en.js')).EN;
      patterns = Object.keys(EN).filter(k => k.includes('{n}')).map(k => {
        const esc = k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{n\\?\}/g, '(.+?)');
        return { k, re: new RegExp('^' + esc + '$', 's') };
      });
    } catch { LANG.v = 'ru'; }
  }
}
const CYR = /[А-Яа-яЁё]/;
export function tr(s) {
  if (LANG.v === 'ru' || !EN || typeof s !== 'string' || !CYR.test(s)) return s;
  const c = cache.get(s); if (c !== undefined) return c;
  let out = EN[s];
  if (out === undefined) {
    for (const p of patterns) {
      const m = s.match(p.re);
      if (m) { let i = 1; out = EN[p.k].replace(/\{n\}/g, () => tr(m[i++] ?? '')); break; }
    }
  }
  if (out === undefined) {
    // составные строки («Глава I · Поле Тиринфа», «Костёр: Горгофон»): переводим по частям
    const parts = s.split(/(\s·\s|:\s|\s—\s)/);
    if (parts.length > 1) {
      let r = '';
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i], sep = parts[i + 1];
        if (i % 2 === 1) { r += p; continue; }
        if (sep && EN[p + sep] !== undefined) { r += EN[p + sep]; i++; continue; }
        r += EN[p] !== undefined ? EN[p] : (CYR.test(p) && p !== s ? tr(p) : p);
      }
      out = r;
    } else out = s;
  }
  if (cache.size > 4000) cache.clear();
  cache.set(s, out); return out;
}
// язык по умолчанию: русский для ru/uk/be/kk, иначе английский
export function pickLang(code) { return /^(ru|uk|be|kk)/.test(code || '') ? 'ru' : 'en'; }
