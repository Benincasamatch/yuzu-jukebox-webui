import { describe, expect, it, vi } from 'vitest';
import type { SearchTrack } from '../api/types';
import { enqueueAlbum } from './albumPlayback';

const tracks: SearchTrack[] = Array.from({ length: 121 }, (_, index) => ({
  track_ref: `ncm:${index + 1}`,
  title: `Track ${index + 1}`,
  artist: 'Artist',
  duration_ms: 180000,
}));

describe('album playback', () => {
  it('queues tracks beyond the first page in album order and respects the batch limit', async () => {
    const submit = vi.fn<(refs: string[]) => Promise<void>>().mockResolvedValue();
    const load = vi.fn(async (limit: number, offset: number) => tracks.slice(offset, offset + limit));
    expect(await enqueueAlbum(load, submit, false)).toBe(121);
    expect(load.mock.calls.map(([, offset]) => offset)).toEqual([0, 50, 100]);
    expect(submit.mock.calls.map(([refs]) => refs.length)).toEqual([100, 21]);
    expect(submit.mock.calls.flatMap(([refs]) => refs)).toEqual(tracks.map((track) => track.track_ref));
  });

  it('shuffles the entire album without losing or duplicating tracks', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const submit = vi.fn<(refs: string[]) => Promise<void>>().mockResolvedValue();
    try {
      await enqueueAlbum(async (limit, offset) => tracks.slice(offset, offset + limit), submit, true);
      const refs = submit.mock.calls.flatMap(([batch]) => batch);
      expect(refs).not.toEqual(tracks.map((track) => track.track_ref));
      expect([...refs].sort()).toEqual(tracks.map((track) => track.track_ref).sort());
    } finally {
      random.mockRestore();
    }
  });

  it('does not submit a partial album when a later page fails', async () => {
    const submit = vi.fn();
    await expect(enqueueAlbum(async (_limit, offset) => {
      if (offset) throw new Error('source unavailable');
      return tracks.slice(0, 50);
    }, submit, false)).rejects.toThrow('source unavailable');
    expect(submit).not.toHaveBeenCalled();
  });

  it('stops after a failed queue write without retrying or submitting later batches', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('queue full'));
    await expect(enqueueAlbum(
      async (limit, offset) => tracks.slice(offset, offset + limit), submit, false,
    )).rejects.toThrow('queue full');
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
