import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncSystemBars } from './nativeui';

vi.mock('./nativeui', () => ({ syncSystemBars: vi.fn() }));
let skin: typeof import('./skin');
let dataset: Record<string, string>;
let storage: Map<string, string>;
let events: EventTarget;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  dataset = { scheme: 'light' };
  storage = new Map([['yuzu-scheme', 'light'], ['yuzu-accent', '#6A8FD8']]);
  events = new EventTarget();
  vi.stubGlobal('document', { documentElement: { dataset } });
  vi.stubGlobal('window', events);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  skin = await import('./skin');
});
afterEach(() => vi.unstubAllGlobals());

describe('optional scarlet appearance', () => {
  it('persists the skin while preserving ordinary scheme/accent and restores system bars on exit', () => {
    skin.applySkin('scarlet');
    expect(skin.currentSkin()).toBe('scarlet');
    expect(storage.get('yuzu-skin')).toBe('scarlet');
    expect(dataset.scheme).toBe('light');
    expect(storage.get('yuzu-scheme')).toBe('light');
    expect(storage.get('yuzu-accent')).toBe('#6A8FD8');
    expect(syncSystemBars).toHaveBeenLastCalledWith('dark');
    skin.applySkin('default');
    expect(syncSystemBars).toHaveBeenLastCalledWith('light');
    expect(storage.get('yuzu-accent')).toBe('#6A8FD8');
  });

  it('restores saved appearance, handles unknown values, and follows cross-tab skin changes', () => {
    storage.set('yuzu-skin', 'scarlet');
    skin.initSkin();
    expect(skin.currentSkin()).toBe('scarlet');
    storage.set('yuzu-skin', 'unknown');
    events.dispatchEvent(Object.assign(new Event('storage'), { key: 'yuzu-skin' }));
    expect(skin.currentSkin()).toBe('default');
    storage.set('yuzu-skin', 'scarlet');
    events.dispatchEvent(Object.assign(new Event('storage'), { key: null }));
    expect(skin.currentSkin()).toBe('scarlet');
  });

  it('notifies all theme surfaces and allows subscribers to unmount cleanly', () => {
    const update = vi.fn();
    const unsubscribe = skin.subscribeSkin(update);
    skin.applySkin('scarlet');
    skin.applySkin('default');
    expect(update).toHaveBeenCalledTimes(2);
    unsubscribe();
    skin.applySkin('scarlet');
    expect(update).toHaveBeenCalledTimes(2);
  });
});
