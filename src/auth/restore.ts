import { YuzuError, type Identity } from '../protocol/types';
import type { TokenStore } from './token';

export function isSessionRejected(error: unknown): boolean {
  return error instanceof YuzuError && error.code === 'unauthorized';
}

/** Only an authoritative auth rejection invalidates a saved session, never a transport failure. */
export function createSessionRestorer(opts: {
  tokens: TokenStore;
  connect: () => Promise<void>;
  authenticate: (token: string) => Promise<Identity>;
  onIdentity: (identity: Identity) => void;
}) {
  let active: Promise<boolean> | null = null;
  return () => {
    if (active) return active;
    active = (async () => {
      const token = opts.tokens.get();
      if (!token) return false;
      try {
        await opts.connect();
        const identity = await opts.authenticate(token);
        if (opts.tokens.get() !== token) return false;
        opts.onIdentity(identity);
        return true;
      } catch (error) {
        if (isSessionRejected(error)) {
          if (opts.tokens.get() === token) opts.tokens.clear();
          return false;
        }
        throw error;
      }
    })().finally(() => { active = null; });
    return active;
  };
}
