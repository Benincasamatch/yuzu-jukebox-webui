import { describe, expect, it, vi } from 'vitest';
import { BROWSER_LOGIN_KEY, createBrowserLoginFlow, isBrowserLoginCallback } from './browser';

function setup() {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  } as Storage;
  const open = vi.fn(async (_url: string) => {});
  const exchange = vi.fn(async (_code: string, _verifier: string) => {});
  const opts = { server: 'https://music.102.yuna.team', storage, open, exchange };
  return { flow: createBrowserLoginFlow(opts), opts, storage, open, exchange };
}

describe('browser login bridge', () => {
  it('opens both providers with PKCE and never sends the verifier in a URL', async () => {
    const { flow, storage, open } = setup();
    for (const provider of ['sso', 'local'] as const) {
      await flow.begin(provider);
      const url = new URL(open.mock.calls.at(-1)![0]);
      const pending = JSON.parse(storage.getItem(BROWSER_LOGIN_KEY)!);
      expect(url.pathname).toBe('/api/v1/auth/browser/start');
      expect(url.searchParams.get('provider')).toBe(provider);
      expect(url.searchParams.get('state')).toBe(pending.state);
      expect(url.searchParams.get('code_challenge')).toHaveLength(43);
      expect(url.href).not.toContain(pending.verifier);
    }
  });

  it('recovers a callback after process restart and deduplicates callback events', async () => {
    const { flow, opts, storage, exchange } = setup();
    await flow.begin('local');
    const pending = JSON.parse(storage.getItem(BROWSER_LOGIN_KEY)!);
    const restarted = createBrowserLoginFlow(opts);
    const url = `yuzu-jukebox://login?code=${'a'.repeat(43)}&state=${pending.state}`;
    expect(await Promise.all([restarted.handleCallback(url), restarted.handleCallback(url)])).toEqual([true, true]);
    expect(exchange).toHaveBeenCalledExactlyOnceWith('a'.repeat(43), pending.verifier);
    expect(storage.getItem(BROWSER_LOGIN_KEY)).toBeNull();
  });

  it('rejects wrong state, expired flows and server changes without exchanging', async () => {
    const { flow, storage, exchange, opts } = setup();
    await flow.begin('sso');
    const pending = JSON.parse(storage.getItem(BROWSER_LOGIN_KEY)!);
    await expect(flow.handleCallback(`yuzu-jukebox://login?code=${'a'.repeat(43)}&state=wrong`)).rejects.toThrow();
    const url = `yuzu-jukebox://login?code=${'a'.repeat(43)}&state=${pending.state}`;
    await expect(createBrowserLoginFlow({ ...opts, server: 'https://other.example' }).handleCallback(url)).rejects.toThrow();
    storage.setItem(BROWSER_LOGIN_KEY, JSON.stringify({ ...pending, expires: 1 }));
    await expect(flow.handleCallback(url)).rejects.toThrow();
    expect(exchange).not.toHaveBeenCalled();
  });

  it('ignores unrelated deep links and permits a new login after logout', async () => {
    const { flow, storage, exchange } = setup();
    expect(isBrowserLoginCallback('https://evil.example/login')).toBe(false);
    expect(await flow.handleCallback('yuzu-jukebox://oauth?code=abc')).toBe(false);
    for (let i = 0; i < 2; i++) {
      await flow.begin('local');
      const pending = JSON.parse(storage.getItem(BROWSER_LOGIN_KEY)!);
      await flow.handleCallback(`yuzu-jukebox://login?code=${'a'.repeat(43)}&state=${pending.state}`);
    }
    expect(exchange).toHaveBeenCalledTimes(2);
  });

  it('only treats an unconsumed matching flow as a pending launch callback', async () => {
    const { flow, storage } = setup();
    const code = 'a'.repeat(43);
    expect(flow.hasPendingCallback(`yuzu-jukebox://login?code=${code}&state=old`)).toBe(false);
    await flow.begin('local');
    const pending = JSON.parse(storage.getItem(BROWSER_LOGIN_KEY)!);
    const callback = `yuzu-jukebox://login?code=${code}&state=${pending.state}`;
    expect(flow.hasPendingCallback(callback)).toBe(true);
    expect(flow.hasPendingCallback(`yuzu-jukebox://login?code=${code}&state=wrong`)).toBe(false);
    await flow.handleCallback(callback);
    expect(flow.hasPendingCallback(callback)).toBe(false);
  });

  it('cleans pending state when the browser fails to open', async () => {
    const { flow, storage, open } = setup();
    open.mockRejectedValueOnce(new Error('cannot open'));
    await expect(flow.begin('local')).rejects.toThrow('cannot open');
    expect(storage.getItem(BROWSER_LOGIN_KEY)).toBeNull();
  });
});
