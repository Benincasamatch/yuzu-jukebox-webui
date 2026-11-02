import { describe, expect, it } from 'vitest';
import { entityRadioSource, isVisibleRadioSource } from './radioSources';

describe('frontend radio source visibility', () => {
  it.each(['ncm:fm', 'ncm:heart', 'qq:fm', 'custom:heart:seed'])('removes the private source %s', (source) => {
    expect(isVisibleRadioSource(source)).toBe(false);
  });

  it.each(['ncm:daily', 'ncm:newsong', 'ncm:toplist:123', 'qq:top:26', 'ncm:simi:123', 'bili:fav:123', 'playlist:heart', 'playlist:fm'])('preserves other music entry points: %s', (source) => {
    expect(isVisibleRadioSource(source)).toBe(true);
  });

  it('does not pick a hidden source as the play action for an external playlist', () => {
    const source = entityRadioSource([{
      id: 'ncm',
      capabilities: { radio_sources: [
        { spec: 'heart', arg: 'playlist_id', finite: false },
        { spec: 'playlist', arg: 'playlist_id', finite: true },
      ] },
    }], 'ncm');
    expect(source?.spec).toBe('playlist');
  });
});
