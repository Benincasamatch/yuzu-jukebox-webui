import { YuzuError } from '../protocol/types';

export const BROWSER_LOGIN_KEY = 'yuzu-browser-login';

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isBrowserLoginCallback(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'yuzu-jukebox:' && url.hostname === 'login' && url.pathname === '';
  } catch { return false; }
}

/** Persist only the pending PKCE flow so Android process death doesn't lose the callback. */
export function createBrowserLoginFlow(opts: {
  server: string;
  storage: Storage;
  open: (url: string) => Promise<void>;
  exchange: (code: string, verifier: string) => Promise<void>;
}) {
  let callbackTask: Promise<boolean> | null = null;
  return {
    hasPendingCallback(raw: string): boolean {
      if (!isBrowserLoginCallback(raw)) return false;
      try {
        const pending = JSON.parse(opts.storage.getItem(BROWSER_LOGIN_KEY) ?? 'null');
        return !!pending && pending.server === opts.server && pending.expires > Date.now() &&
          pending.state === new URL(raw).searchParams.get('state');
      } catch { return false; }
    },
    async begin(provider: 'sso' | 'local'): Promise<void> {
      const server = new URL(opts.server);
      if (server.protocol !== 'https:' || server.username || server.password) {
        throw new YuzuError('bad_request', 'Browser login requires an HTTPS server');
      }
      callbackTask = null;
      const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      const url = new URL('/api/v1/auth/browser/start', server);
      url.search = new URLSearchParams({ provider, state, code_challenge: challenge }).toString();
      opts.storage.setItem(BROWSER_LOGIN_KEY, JSON.stringify({ server: opts.server, verifier, state, expires: Date.now() + 10 * 60_000 }));
      try { await opts.open(url.href); }
      catch (error) { opts.storage.removeItem(BROWSER_LOGIN_KEY); throw error; }
    },
    handleCallback(raw: string): Promise<boolean> {
      if (!isBrowserLoginCallback(raw)) return Promise.resolve(false);
      if (callbackTask) return callbackTask;
      callbackTask = (async () => {
        const url = new URL(raw);
        const stored = opts.storage.getItem(BROWSER_LOGIN_KEY);
        let pending: { server?: string; verifier?: string; state?: string; expires?: number } | null = null;
        try { pending = stored ? JSON.parse(stored) : null; } catch { /* corrupted storage */ }
        const code = url.searchParams.get('code');
        if (!pending || pending.server !== opts.server || !pending.verifier || !pending.state ||
            !pending.expires || Date.now() >= pending.expires || url.searchParams.get('state') !== pending.state ||
            !code || !/^[A-Za-z0-9_-]{43}$/.test(code)) {
          throw new YuzuError('bad_request', 'Login callback does not match; retry from App');
        }
        await opts.exchange(code, pending.verifier);
        opts.storage.removeItem(BROWSER_LOGIN_KEY);
        return true;
      })();
      // Deduplicate simultaneous events, but allow a network-failed exchange to retry.
      void callbackTask.catch(() => { callbackTask = null; });
      return callbackTask;
    },
  };
}
