import { describe, expect, it } from 'vitest';
import { artistHref, splitArtistNames, tokenizeArtists } from './artist';

describe('splitArtistNames', () => {
  it('keeps a single artist name unchanged', () => {
    expect(splitArtistNames('ヨルシカ')).toEqual(['ヨルシカ']);
  });

  it('splits the common CJK/ASCII separators with surrounding whitespace', () => {
    expect(splitArtistNames('塞壬唱片-MSR/F.L.O.A.T (白羽）/张晶')).toEqual([
      '塞壬唱片-MSR',
      'F.L.O.A.T (白羽）',
      '张晶',
    ]);
    expect(splitArtistNames('A／B、C，D,E；F; G / H')).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
    ]);
  });

  it('does not split on hyphens, dots or ampersands', () => {
    expect(splitArtistNames('塞壬唱片-MSR & Friends')).toEqual(['塞壬唱片-MSR & Friends']);
  });

  it('trims, drops empties and dedupes in order', () => {
    expect(splitArtistNames(' A // B /A/ ')).toEqual(['A', 'B']);
  });

  it('prefers contributors and never splits names containing separators', () => {
    expect(
      splitArtistNames('AC/DC', [{ role: 'artist', name: 'AC/DC' }]),
    ).toEqual(['AC/DC']);
  });

  it('uses uploader-role contributors (bili/local) but ignores other roles', () => {
    expect(
      splitArtistNames('某UP', [
        { role: 'composer', name: '别人' },
        { role: 'uploader', name: '某UP' },
      ]),
    ).toEqual(['某UP']);
  });

  it('falls back to string split when contributors have no artist entries', () => {
    expect(splitArtistNames('A/B', [{ role: 'composer', name: 'C' }])).toEqual(['A', 'B']);
  });
});

describe('tokenizeArtists', () => {
  it('preserves separators as plain text between linked names', () => {
    expect(tokenizeArtists('A / B、C')).toEqual([
      { text: 'A', name: 'A' },
      { text: ' / ' },
      { text: 'B', name: 'B' },
      { text: '、' },
      { text: 'C', name: 'C' },
    ]);
  });

  it('anchors contributor names inside the display string and carries entity ids', () => {
    expect(
      tokenizeArtists('AC/DC feat. 张三', [
        { role: 'artist', name: 'AC/DC', entity_id: '111' },
        { role: 'artist', name: '张三' },
      ]),
    ).toEqual([
      { text: 'AC/DC', name: 'AC/DC', entityId: '111' },
      { text: ' feat. ' },
      { text: '张三', name: '张三', entityId: undefined },
    ]);
  });

  it('falls back to separator split when no contributor name appears in the string', () => {
    expect(tokenizeArtists('甲/乙', [{ role: 'artist', name: '丙' }])).toEqual([
      { text: '甲', name: '甲' },
      { text: '/' },
      { text: '乙', name: '乙' },
    ]);
  });
});

describe('artistHref', () => {
  it('encodes the name and carries the track anchor', () => {
    expect(artistHref('塞壬唱片-MSR/张晶', { trackRef: 'ncm:1' })).toBe(
      `/artist/${encodeURIComponent('塞壬唱片-MSR/张晶')}?track=ncm%3A1`,
    );
  });

  it('prefers provider+entity direct links over the track anchor', () => {
    expect(artistHref('Chevy', { provider: 'ncm', entityId: '47992679', trackRef: 'ncm:1' })).toBe(
      '/artist/Chevy?provider=ncm&entity=47992679',
    );
  });

  it('omits the query without a track ref', () => {
    expect(artistHref('A')).toBe('/artist/A');
  });
});
