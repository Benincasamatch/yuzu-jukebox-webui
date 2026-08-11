/**
 * 主题运行时：scheme（深/浅）与 accent（主题色）两条用户轴。
 * 与 design/mockup.html 的机制一致：只写 CSS 变量，组件无感知。
 */

import { defaultAccent } from '../config';
import { syncSystemBars } from './nativeui';

export type Scheme = 'dark' | 'light';

const ACCENT_KEY = 'yuzu-accent';
const SCHEME_KEY = 'yuzu-scheme';

/** accent 上的可读文字色（YIQ 亮度判定；阈值 120 使 #1DB954 绿落到深色文字，与 Spotify 一致） */
function onAccentFor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 120 ? '#0A1F10' : '#F5F2EC';
}

export function applyAccent(hex: string, persist = true): void {
  const root = document.documentElement;
  root.style.setProperty('--accent', hex);
  root.style.setProperty('--on-accent', onAccentFor(hex));
  root.style.setProperty('--accent-soft', `color-mix(in srgb, ${hex} 13%, transparent)`);
  root.style.setProperty('--accent-line', `color-mix(in srgb, ${hex} 40%, transparent)`);
  root.style.setProperty('--ring', `color-mix(in srgb, ${hex} 55%, transparent)`);
  if (persist) localStorage.setItem(ACCENT_KEY, hex);
}

export function applyScheme(scheme: Scheme, persist = true): void {
  document.documentElement.dataset.scheme = scheme;
  syncSystemBars(scheme);
  if (persist) localStorage.setItem(SCHEME_KEY, scheme);
  else localStorage.removeItem(SCHEME_KEY);
}

export function currentScheme(): Scheme {
  return document.documentElement.dataset.scheme === 'light' ? 'light' : 'dark';
}

export function currentAccent(): string {
  return localStorage.getItem(ACCENT_KEY) || defaultAccent;
}

/** 应用启动时调用一次：恢复持久化的 accent。scheme 不跟随系统——默认深色
 * （index.html 首帧脚本落定），用户切换经 applyScheme 持久化。 */
export function initTheme(): void {
  applyAccent(currentAccent(), false);
  // 初始 scheme 由 index.html 首帧脚本落定，这里只向原生侧同步一次
  syncSystemBars(currentScheme());
}
