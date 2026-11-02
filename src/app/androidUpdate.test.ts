import { describe, expect, it } from 'vitest';
import { newerAndroidUpdate, parseAndroidUpdate } from './androidUpdate';
const feed = 'https://music.example/app-updates/latest.json';
const installed = { id: 'dev.uwen.yuzujukebox', build: '10103' };
const manifest = { packageId: installed.id, versionCode: 10200, versionName: '1.2.0', apkUrl: './yuzu-jukebox-1.2.0.apk', sha256: 'a'.repeat(64), notes: '界面更新' };

describe('Android update metadata', () => {
  it('accepts a newer package from the trusted HTTPS origin', () => {
    expect(newerAndroidUpdate(JSON.stringify(manifest), feed, installed)?.apkUrl).toBe('https://music.example/app-updates/yuzu-jukebox-1.2.0.apk');
  });
  it('does not prompt for the installed version or an older version', () => {
    expect(newerAndroidUpdate(manifest, feed, { ...installed, build: '10200' })).toBeNull();
    expect(newerAndroidUpdate(manifest, feed, { ...installed, build: '10300' })).toBeNull();
  });
  it.each([
    { ...manifest, packageId: 'other.app' },
    { ...manifest, versionCode: '10200' },
    { ...manifest, versionCode: -1 },
    { ...manifest, versionCode: 1.2 },
    { ...manifest, versionName: '' },
    { ...manifest, sha256: 'bad' },
    { ...manifest, apkUrl: 'https://evil.example/file.apk' },
    { ...manifest, apkUrl: 'http://music.example/file.apk' },
    { ...manifest, apkUrl: 'javascript:alert(1)' },
    { ...manifest, apkUrl: './index.html' },
    null,
    '<html>not a feed</html>',
  ])('rejects invalid or mismatched updates', (raw) => {
    expect(() => parseAndroidUpdate(raw, feed, installed.id)).toThrow();
  });
  it('rejects a cleartext feed and invalid installed build', () => {
    expect(() => parseAndroidUpdate(manifest, feed.replace('https:', 'http:'), installed.id)).toThrow();
    expect(() => newerAndroidUpdate(manifest, feed, { ...installed, build: 'unknown' })).toThrow();
  });
});
