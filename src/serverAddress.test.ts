import { describe, expect, it } from 'vitest';
import { DEFAULT_NATIVE_SERVER, resolveServerAddress } from './serverAddress';

describe('server address defaults', () => {
  it('defaults a fresh native installation to the music server', () => {
    expect(resolveServerAddress({ native: true })).toBe('https://music.102.yuna.team');
    expect(resolveServerAddress({ native: true, runtime: '', override: '' })).toBe(DEFAULT_NATIVE_SERVER);
  });
  it('preserves a user-selected server and explicit deployment overrides', () => {
    expect(resolveServerAddress({ native: true, override: ' https://custom.example/// ', runtime: 'https://runtime.example' })).toBe('https://custom.example');
    expect(resolveServerAddress({ native: true, runtime: 'https://runtime.example', build: 'https://build.example' })).toBe('https://runtime.example');
    expect(resolveServerAddress({ native: true, build: 'https://build.example' })).toBe('https://build.example');
  });
  it('keeps browser deployments same-origin and ignores native overrides', () => {
    expect(resolveServerAddress({ native: false, override: 'https://custom.example' })).toBe('');
  });
});
