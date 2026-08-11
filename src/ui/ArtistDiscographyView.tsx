/**
 * 艺人全部作品页（/artist/:name/discography?provider=&entity=）：
 * 参照 Spotify 的 Show All——每张专辑一个区块（封面 + 元信息 + 整带入队 +
 * 曲目表）。曲目在区块滚动接近视口时才钻取（每张专辑一个请求，全量预取
 * 会形成请求风暴）。必须从艺人页带 provider/entity 进入；缺参只给返回链接。
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Disc3, Play } from 'lucide-react';
import type { SearchEntity, SearchTrack } from '../api/types';
import { api } from '../app/session';
import { coverSrc } from './cover';
import { TrackList, searchTrackToRow, useEnqueue } from './TrackList';
import { useToast } from './toast';

const PAGE_SIZE = 50;

export default function ArtistDiscographyView(): JSX.Element {
  const { t } = useTranslation();
  const { name: rawName } = useParams();
  const [searchParams] = useSearchParams();
  const name = rawName ?? '';
  const provider = searchParams.get('provider');
  const entity = searchParams.get('entity');
  const { showError } = useToast();
  const [albums, setAlbums] = useState<SearchEntity[] | null>(null);

  useEffect(() => {
    if (!provider || !entity) return;
    let dead = false;
    setAlbums(null);
    api
      .searchEntityAlbums(provider, entity, { limit: PAGE_SIZE })
      .then((rows) => {
        if (!dead) setAlbums(rows);
      })
      .catch((error: unknown) => {
        if (dead) return;
        setAlbums([]);
        showError(error);
      });
    return () => {
      dead = true;
    };
  }, [provider, entity, showError]);

  const artistQuery =
    provider && entity
      ? `?provider=${encodeURIComponent(provider)}&entity=${encodeURIComponent(entity)}`
      : '';

  return (
    <div className="view-enter px-4 pt-4 pb-10 md:px-8 md:pt-6">
      <Link
        to={`/artist/${encodeURIComponent(name)}${artistQuery}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition hover:text-paper"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {name}
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold text-paper">{t('artistPage.allAlbums')}</h1>

      {!provider || !entity ? (
        <p className="py-10 text-center text-sm text-faint">{t('artistPage.noContent')}</p>
      ) : albums === null ? (
        <p className="py-10 text-center text-sm text-muted">{t('common.loading')}</p>
      ) : albums.length === 0 ? (
        <p className="py-10 text-center text-sm text-faint">{t('artistPage.noContent')}</p>
      ) : (
        albums.map((album) => (
          <AlbumSection key={album.entity_id} provider={provider} album={album} />
        ))
      )}
    </div>
  );
}

function AlbumSection({ provider, album }: { provider: string; album: SearchEntity }): JSX.Element {
  const { t } = useTranslation();
  const { showError } = useToast();
  const enqueue = useEnqueue();
  const [tracks, setTracks] = useState<SearchTrack[] | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const entityId = album.entity_id;

  // 滚动接近视口才钻取曲目（rootMargin 预取提前量）；无 entity_id 的专辑不钻取
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || !entityId) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        api
          .searchEntity(provider, 'album', entityId, { limit: PAGE_SIZE })
          .then(setTracks)
          .catch((error: unknown) => {
            setTracks([]);
            showError(error);
          });
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [provider, entityId, showError]);

  return (
    <section ref={sectionRef} className="mb-12">
      <div className="mb-4 flex items-end gap-5">
        {album.cover_url ? (
          <img
            src={coverSrc(album.cover_url)}
            alt={album.name ?? ''}
            className="h-32 w-32 flex-none rounded-md object-cover md:h-36 md:w-36"
          />
        ) : (
          <span className="grid h-32 w-32 flex-none place-items-center rounded-md bg-panel-2 text-faint md:h-36 md:w-36">
            <Disc3 className="h-8 w-8" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1 pb-1">
          <h2 className="truncate text-xl font-bold text-paper md:text-2xl">{album.name}</h2>
          {album.detail && <div className="mt-1 text-[13px] text-muted">{album.detail}</div>}
          <button
            type="button"
            disabled={!tracks || tracks.length === 0}
            onClick={() => enqueue((tracks ?? []).map((track) => track.track_ref))}
            title={t('artistPage.addAll')}
            aria-label={t('artistPage.addAll')}
            className="mt-3 grid h-10 w-10 place-items-center rounded-full bg-accent text-on-accent transition hover:scale-105 hover:brightness-105 disabled:opacity-40 disabled:hover:scale-100"
          >
            <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true" />
          </button>
        </div>
      </div>
      {tracks === null ? (
        entityId ? (
          <p className="py-6 text-center text-sm text-muted">{t('common.loading')}</p>
        ) : null
      ) : tracks.length > 0 ? (
        <TrackList tracks={tracks.map(searchTrackToRow)} />
      ) : null}
    </section>
  );
}
