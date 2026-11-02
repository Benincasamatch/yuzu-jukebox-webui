import { describe, expect, it, vi } from 'vitest';
import { YuzuError, type Identity } from '../protocol/types';
import { createSessionRestorer } from './restore';

const identity: Identity = { id: 'u1', name: 'Alice', kind: 'unified', roles: ['listener'] };
function setup() {
  let token: string | null = 'saved-session';
  const tokens = { get: () => token, set: (next: string) => { token = next; }, clear: vi.fn(() => { token = null; }) };
  const connect = vi.fn(async () => {});
  const authenticate = vi.fn(async (_token: string) => identity);
  const onIdentity = vi.fn();
  return { restore: createSessionRestorer({ tokens, connect, authenticate, onIdentity }), tokens, connect, authenticate, onIdentity };
}

describe('persistent session recovery', () => {
  it('restores a saved session without a new login', async () => {
    const { restore, tokens, authenticate, onIdentity } = setup();
    expect(await restore()).toBe(true);
    expect(authenticate).toHaveBeenCalledWith('saved-session');
    expect(onIdentity).toHaveBeenCalledWith(identity);
    expect(tokens.get()).toBe('saved-session');
  });
  it.each([new TypeError('network failed'), new YuzuError('internal', 'connection timeout'), new YuzuError('internal', 'server restarting')])('keeps the token after %s and supports retry', async (error) => {
    const { restore, connect, tokens } = setup();
    connect.mockRejectedValueOnce(error);
    await expect(restore()).rejects.toThrow();
    expect(tokens.get()).toBe('saved-session');
    expect(await restore()).toBe(true);
  });
  it('only clears an explicitly rejected session', async () => {
    const { restore, tokens, authenticate } = setup();
    authenticate.mockRejectedValueOnce(new YuzuError('unauthorized', 'session expired'));
    expect(await restore()).toBe(false);
    expect(tokens.get()).toBeNull();
  });
  it('does not cache a missing token forever', async () => {
    const { restore, tokens } = setup();
    tokens.clear();
    expect(await restore()).toBe(false);
    tokens.set('new-session');
    expect(await restore()).toBe(true);
  });
  it('coalesces simultaneous boot calls', async () => {
    const { restore, connect } = setup();
    await Promise.all([restore(), restore()]);
    expect(connect).toHaveBeenCalledTimes(1);
  });
  it('does not clear a newer login when an old recovery attempt is rejected', async () => {
    const { restore, tokens, authenticate } = setup();
    authenticate.mockImplementationOnce(async () => {
      tokens.set('new-session');
      throw new YuzuError('unauthorized', 'old session rejected');
    });
    expect(await restore()).toBe(false);
    expect(tokens.get()).toBe('new-session');
  });
  it('does not restore an identity after logout during recovery', async () => {
    const { restore, tokens, authenticate, onIdentity } = setup();
    authenticate.mockImplementationOnce(async () => { tokens.clear(); return identity; });
    expect(await restore()).toBe(false);
    expect(onIdentity).not.toHaveBeenCalled();
  });
});
