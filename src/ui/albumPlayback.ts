import type { SearchTrack } from '../api/types';

const PAGE_SIZE = 50;
const QUEUE_CHUNK_SIZE = 100;

/** Fetch the whole album before shuffling or submitting any queue writes. */
export async function enqueueAlbum(
  loadPage: (limit: number, offset: number) => Promise<SearchTrack[]>,
  submit: (refs: string[]) => Promise<unknown>,
  shuffle: boolean,
): Promise<number> {
  const refs: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const tracks = await loadPage(PAGE_SIZE, offset);
    refs.push(...tracks.map((track) => track.track_ref));
    if (tracks.length < PAGE_SIZE) break;
  }
  if (shuffle) {
    for (let index = refs.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [refs[index], refs[other]] = [refs[other]!, refs[index]!];
    }
  }
  for (let index = 0; index < refs.length; index += QUEUE_CHUNK_SIZE) {
    await submit(refs.slice(index, index + QUEUE_CHUNK_SIZE));
  }
  return refs.length;
}
