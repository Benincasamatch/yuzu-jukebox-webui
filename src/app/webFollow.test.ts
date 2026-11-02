import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadWebFollow, readWebFollow, saveWebFollow } from './webFollow';

afterEach(() => vi.unstubAllGlobals());

describe('browser follow cookie', () => {
  it.each(['', 'other=1', 'yuzu-web-follow=0', 'yuzu-web-follow=true', 'other-yuzu-web-follow=1'])('defaults off for %s', (cookie) => {
    expect(readWebFollow(cookie)).toBe(false);
  });
  it('restores only explicit opt-in among other cookies', () => {
    expect(readWebFollow('other=a; yuzu-web-follow=1; final=b')).toBe(true);
  });
  it('stays off and usable if privacy settings reject cookies', () => {
    vi.stubGlobal('document', { get cookie() { throw new Error('blocked'); }, set cookie(_value: string) { throw new Error('blocked'); } });
    vi.stubGlobal('location', { protocol: 'https:' });
    expect(loadWebFollow()).toBe(false);
    expect(() => saveWebFollow(true)).not.toThrow();
  });
  it.each(['http:', 'https:'])('saves an origin-local year-long preference on %s', (protocol) => {
    const target = { cookie: '' };
    vi.stubGlobal('document', target);
    vi.stubGlobal('location', { protocol });
    saveWebFollow(true);
    expect(target.cookie).toContain('yuzu-web-follow=1; Path=/; Max-Age=31536000; SameSite=Lax');
    expect(target.cookie.includes('; Secure')).toBe(protocol === 'https:');
    saveWebFollow(false);
    expect(target.cookie.startsWith('yuzu-web-follow=0;')).toBe(true);
  });
});
