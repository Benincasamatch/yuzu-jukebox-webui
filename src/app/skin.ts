import { syncSystemBars } from './nativeui';

export type Skin = 'default' | 'scarlet';
const SKIN_KEY = 'yuzu-skin';
const CHANGE_EVENT = 'yuzu-skin-change';
let initialized = false;

export function currentSkin(): Skin {
  return document.documentElement.dataset.skin === 'scarlet' ? 'scarlet' : 'default';
}

export function subscribeSkin(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

/** Keep the user's ordinary scheme/accent intact so exiting the skin restores them. */
export function applySkin(skin: Skin, persist = true): void {
  const root = document.documentElement;
  root.dataset.skin = skin;
  if (persist) localStorage.setItem(SKIN_KEY, skin);
  syncSystemBars(skin === 'scarlet' ? 'dark' : root.dataset.scheme === 'light' ? 'light' : 'dark');
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function initSkin(): void {
  applySkin(localStorage.getItem(SKIN_KEY) === 'scarlet' ? 'scarlet' : 'default', false);
  if (initialized) return;
  initialized = true;
  window.addEventListener('storage', (event) => {
    if (event.key === SKIN_KEY || event.key === null) {
      applySkin(localStorage.getItem(SKIN_KEY) === 'scarlet' ? 'scarlet' : 'default', false);
    }
  });
}
