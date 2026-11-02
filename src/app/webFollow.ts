export const WEB_FOLLOW_COOKIE = 'yuzu-web-follow';

/** Only explicit opt-in enables sound; missing/invalid preferences stay off. */
export function readWebFollow(cookie: string): boolean {
  return cookie.split(';').some((part) => part.trim() === `${WEB_FOLLOW_COOKIE}=1`);
}

export function loadWebFollow(): boolean {
  try { return readWebFollow(document.cookie); }
  catch { return false; }
}

export function saveWebFollow(enabled: boolean): void {
  try { document.cookie = `${WEB_FOLLOW_COOKIE}=${enabled ? '1' : '0'}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; } catch { /* Cookie blocking must not prevent local playback controls. */ }
}
