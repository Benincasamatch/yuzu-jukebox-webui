export interface AndroidUpdate {
  packageId: string;
  versionCode: number;
  versionName: string;
  apkUrl: string;
  sha256: string;
  notes: string;
}

/** The trusted HTTPS feed may only link to APKs on its own origin. */
export function parseAndroidUpdate(raw: unknown, feed: string, packageId: string): AndroidUpdate {
  const source = typeof raw === 'string' ? JSON.parse(raw) as unknown : raw;
  if (!source || typeof source !== 'object') throw new Error('Invalid update manifest');
  const value = source as Record<string, unknown>;
  const base = new URL(feed);
  if (base.protocol !== 'https:' || base.username || base.password || value.packageId !== packageId ||
      !Number.isSafeInteger(value.versionCode) || Number(value.versionCode) < 1 ||
      typeof value.versionName !== 'string' || !value.versionName.trim() || value.versionName.length > 80 ||
      typeof value.apkUrl !== 'string' || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(value.sha256)) {
    throw new Error('Invalid update manifest');
  }
  const apk = new URL(value.apkUrl, base);
  if (apk.origin !== base.origin || apk.protocol !== 'https:' || !apk.pathname.endsWith('.apk') || apk.username || apk.password) throw new Error('Invalid APK address');
  return {
    packageId, versionCode: Number(value.versionCode), versionName: value.versionName,
    apkUrl: apk.href, sha256: value.sha256.toLowerCase(),
    notes: typeof value.notes === 'string' ? value.notes.slice(0, 4000) : '',
  };
}

export function newerAndroidUpdate(raw: unknown, feed: string, installed: { id: string; build: string }): AndroidUpdate | null {
  const build = Number(installed.build);
  if (!Number.isSafeInteger(build) || build < 1) throw new Error('Invalid installed version');
  const update = parseAndroidUpdate(raw, feed, installed.id);
  return update.versionCode > build ? update : null;
}

export const CHECK_ANDROID_UPDATE_EVENT = 'yuzu-check-android-update';
export function requestAndroidUpdateCheck(): void {
  window.dispatchEvent(new Event(CHECK_ANDROID_UPDATE_EVENT));
}
