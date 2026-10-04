// Площадки: Яндекс Игры (YaGames SDK), Poki (PokiSDK) или локально (заглушки). Один интерфейс для игры.
// Требования (docs/platforms.md): LoadingAPI.ready / gameLoadingFinished, gameplay start/stop по реальным моментам,
// реклама только в естественных паузах, за награду — только по кнопке игрока, звук выключен во время рекламы.
import { audioState, applyVolumes, suspendAudio } from './audio.js';

let kind = 'local', ysdk = null, poki = null, playing = false, adBusy = false;
export const platform = { get kind() { return kind; }, lang: 'ru' };

function muteForAd(on) { audioState.muted = on; applyVolumes(); suspendAudio(on); }

export async function initPlatform() {
  try {
    if (window.YaGames) {
      ysdk = await window.YaGames.init(); kind = 'yandex';
      platform.lang = ysdk.environment?.i18n?.lang || 'ru';
      ysdk.on?.('game_api_pause', () => { muteForAd(true); }); ysdk.on?.('game_api_resume', () => { muteForAd(false); });
    } else if (window.PokiSDK) {
      await window.PokiSDK.init(); poki = window.PokiSDK; kind = 'poki';
      platform.lang = (navigator.language || 'en').slice(0, 2);
    } else platform.lang = (new URLSearchParams(location.search).get('lang')) || (navigator.language || 'ru').slice(0, 2);
  } catch (e) { console.warn('platform init', e); kind = 'local'; }
  return platform;
}
export function loadingDone() { try { if (ysdk) ysdk.features?.LoadingAPI?.ready(); if (poki) poki.gameLoadingFinished(); } catch { } }
export function gameplayStart() { if (playing) return; playing = true; try { ysdk?.features?.GameplayAPI?.start(); poki?.gameplayStart(); } catch { } }
export function gameplayStop() { if (!playing) return; playing = false; try { ysdk?.features?.GameplayAPI?.stop(); poki?.gameplayStop(); } catch { } }

// Реклама в естественной паузе (между главами). Площадка сама решает, показывать ли.
export function commercialBreak() {
  if (adBusy) return Promise.resolve();
  return new Promise(res => {
    const done = () => { adBusy = false; muteForAd(false); res(); };
    try {
      if (ysdk) { adBusy = true; ysdk.adv.showFullscreenAdv({ callbacks: { onOpen: () => muteForAd(true), onClose: done, onError: done, onOffline: done } }); return; }
      if (poki) { adBusy = true; muteForAd(true); poki.commercialBreak().then(done, done); return; }
    } catch { }
    res();
  });
}
// Реклама за награду: только по нажатию игрока; true — награду выдать
export function rewardedBreak() {
  if (adBusy) return Promise.resolve(false);
  return new Promise(res => {
    let reward = false; const done = () => { adBusy = false; muteForAd(false); res(reward); };
    try {
      if (ysdk) { adBusy = true; ysdk.adv.showRewardedVideo({ callbacks: { onOpen: () => muteForAd(true), onRewarded: () => { reward = true; }, onClose: done, onError: done } }); return; }
      if (poki) { adBusy = true; muteForAd(true); poki.rewardedBreak().then(ok => { reward = !!ok; done(); }, done); return; }
    } catch { }
    res(kind === 'local'); // локально — награда сразу (для проверки)
  });
}
export const hasAds = () => kind !== 'local';

// Облачное сохранение Яндекса (поверх localStorage); у Poki — только localStorage
export async function cloudLoad() { try { if (ysdk) { const p = await ysdk.getPlayer({ scopes: false }); return await p.getData(['save']).then(d => d.save || null); } } catch { } return null; }
let saveT = 0;
export function cloudSave(data) { if (!ysdk) return; const now = Date.now(); if (now - saveT < 3500) return; saveT = now; ysdk.getPlayer({ scopes: false }).then(p => p.setData({ save: data })).catch(() => { }); }
