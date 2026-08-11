/**
 * 歌手页（/artist/:name）：provider 歌手实体页，不再是本地收听档案。
 * 实体来源三种：
 * - ?provider=&entity=（搜索艺人卡直达，零解析）；
 * - ?track=<track_ref>（NowPlaying 播放曲目锚定，服务端优先用该 provider 解析）；
 * - 无参数（服务端全局名字解析）。
 * 内容 = 专辑列表（provider 能力 entity_albums 时，可再钻曲目）+ 热门曲目（into=tracks）。
 * 解析失败（本地媒体/名字查不到/多艺人）显示名字 + 空态提示，不降级、不报错。
 *
 * 布局参照 Spotify 艺人页：顶部通栏横幅（头像作背景 + 渐变压暗，底部锚定
 * 大字名）→ 播放全部主按钮 → 热门曲目 → 专辑 → 关于（bio）。
 * 注意：useParams 返回的路由参数已被 react-router 解码，不得再 decodeURIComponent
 * （曾对含 % 的艺人名双重解码抛 URIError，整树白屏）。
 */
import { useCallback, useEffect, useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Disc3, Play, User } from 'lucide-react';
import type { SearchEntity, SearchTrack } from '../api/types';
import { api } from '../app/session';
import { coverSrc, originalCoverSrc } from './cover';
import { extractGlowColors } from './glow';
import { TrackList, searchTrackToRow, useEnqueue } from './TrackList';
import { useProviders } from './hooks';
import { useToast } from './toast';

const PAGE_SIZE = 50;

export default function ArtistView(): JSX.Element {
  const { t } = useTranslation();
  const { name: rawName } = useParams();
  const [searchParams] = useSearchParams();
  const name = rawName ?? '';
  const providerOverride = searchParams.get('provider');
  const entityOverride = searchParams.get('entity');
  const trackRef = searchParams.get('track') ?? undefined;
  const providers = useProviders();
  const { showError } = useToast();
  const enqueue = useEnqueue();

  // 解析结果（搜索直达不调解析端点）
  const [resolved, setResolved] = useState<{
    provider: string;
    entityId: string;
    avatarUrl?: string;
    bio?: string;
  } | null>(null);
  const [resolving, setResolving] = useState(false);

  // 内容区：专辑（能力允许时）+ 曲目；专辑点击进入页内钻取
  const [albums, setAlbums] = useState<SearchEntity[] | null>(null);
  const [tracks, setTracks] = useState<SearchTrack[] | null>(null);
  const [drill, setDrill] = useState<{ album: SearchEntity; tracks: SearchTrack[] } | null>(null);
  const [busy, setBusy] = useState(false);
  // 热门曲目默认只展示前 5 首（Spotify Popular 形态），展开后显示全部
  const [tracksExpanded, setTracksExpanded] = useState(false);
  // 移动端 hero 渐变取色（头像主色，与歌单页 headerColor 同手法；头像缺失回退面板色）
  const [heroColor, setHeroColor] = useState('var(--panel-2)');

  const handleAvatarLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    setHeroColor(extractGlowColors(event.currentTarget)?.[0] ?? 'var(--panel-2)');
  };

  useEffect(() => {
    let dead = false;
    if (providerOverride && entityOverride) {
      // 搜索艺人卡直达：内容零解析；头像/bio 走 provider+entity 直达解析
      // （服务端 ArtistIDDetailer 按实体键取，零搜索）；仅同实体才采用
      setResolved({ provider: providerOverride, entityId: entityOverride });
      api
        .artistProfile(name, { provider: providerOverride, entityId: entityOverride })
        .then((profile) => {
          if (dead) return;
          if (profile.provider === providerOverride && profile.entity_id === entityOverride) {
            setResolved({
              provider: providerOverride,
              entityId: entityOverride,
              avatarUrl: profile.avatar_url,
              bio: profile.bio,
            });
          }
        })
        .catch(() => {});
      return () => {
        dead = true;
      };
    }
    setResolving(true);
    setResolved(null);
    api
      .artistProfile(name, { trackRef })
      .then((profile) => {
        if (dead) return;
        if (profile.provider && profile.entity_id) {
          setResolved({
            provider: profile.provider,
            entityId: profile.entity_id,
            avatarUrl: profile.avatar_url,
            bio: profile.bio,
          });
        } else {
          setResolved(null);
        }
      })
      .catch((error: unknown) => {
        if (dead) return;
        setResolved(null);
        showError(error);
      })
      .finally(() => {
        if (!dead) setResolving(false);
      });
    return () => {
      dead = true;
    };
  }, [name, trackRef, providerOverride, entityOverride, showError]);

  // 解析出实体后按稳定原语派生（不得用派生对象作 effect 依赖——
  // 对象每轮 render 重建会触发 effect 无限重发请求）
  const providerId = resolved?.provider ?? null;
  const entityId = resolved?.entityId ?? null;
  const entityAlbums =
    providerId !== null &&
    (providers?.find((p) => p.id === providerId)?.capabilities?.entity_albums === true);

  useEffect(() => {
    if (!providerId || !entityId) {
      setAlbums(null);
      setTracks(null);
      setDrill(null);
      return;
    }
    let dead = false;
    setAlbums(null);
    setTracks(null);
    setDrill(null);
    const albumTask = entityAlbums
      ? api.searchEntityAlbums(providerId, entityId, { limit: PAGE_SIZE }).then(setAlbums)
      : Promise.resolve(setAlbums([]));
    const trackTask = api
      .searchEntity(providerId, 'artist', entityId, { limit: PAGE_SIZE })
      .then(setTracks);
    Promise.all([albumTask, trackTask]).catch((error: unknown) => {
      if (!dead) showError(error);
    });
    return () => {
      dead = true;
    };
  }, [providerId, entityId, entityAlbums, showError]);

  useEffect(() => {
    setHeroColor('var(--panel-2)');
  }, [name]);

  const openAlbum = useCallback(
    (album: SearchEntity) => {
      if (!providerId || !entityId || !album.entity_id || busy) return;
      setBusy(true);
      void api
        .searchEntity(providerId, 'album', album.entity_id, { limit: PAGE_SIZE })
        .then((rows) => setDrill({ album, tracks: rows }))
        .catch(showError)
        .finally(() => setBusy(false));
    },
    [providerId, entityId, busy, showError],
  );

  const addAllTracks = () => {
    if (!tracks || tracks.length === 0) return;
    enqueue(tracks.map((track) => track.track_ref));
  };

  return (
    <div className="view-enter pb-10">
      {/* 移动端 hero（Spotify 移动艺人页）：头像主色渐变背板 + 居中圆形头像 +
          大字名左对齐；桌面端保留下方通栏横幅 */}
      <header
        className="md:hidden"
        style={{
          background: `linear-gradient(to bottom, color-mix(in srgb, ${heroColor} 55%, transparent), transparent)`,
        }}
      >
        <div className="flex flex-col px-4 pt-8 pb-5">
          {resolved?.avatarUrl ? (
            <img
              src={originalCoverSrc(resolved.avatarUrl)}
              alt=""
              onLoad={handleAvatarLoad}
              className="mx-auto h-44 w-44 rounded-full object-cover shadow-2xl"
            />
          ) : (
            <div className="mx-auto grid h-44 w-44 place-items-center rounded-full bg-panel-2 text-faint shadow-2xl">
              <User className="h-16 w-16" aria-hidden="true" />
            </div>
          )}
          <h1 className="mt-5 text-3xl leading-[1.05] font-extrabold tracking-tight break-words text-paper">
            {name}
          </h1>
          {resolved?.bio && (
            <p className="mt-1.5 line-clamp-2 text-[13px] text-muted">{resolved.bio}</p>
          )}
          {!resolving && !resolved && (
            <p className="mt-1.5 text-[13px] text-muted">{t('artistPage.noEntity')}</p>
          )}
        </div>
      </header>

      {/* 桌面通栏横幅：头像作背景（object-cover 裁切，焦点偏上保人脸），渐变压暗汇入面板底色。
          高度锚定视口 ~40%（hero:内容 ≈ 4:6），下保障碍下限/上限。
          大幅面必须原图：默认封面端点回源 300px 缩略，全宽横幅会糊 */}
      <header className="relative hidden h-[38vh] min-h-[300px] max-h-[520px] flex-col justify-end overflow-hidden md:flex">
        {resolved?.avatarUrl ? (
          <img
            src={originalCoverSrc(resolved.avatarUrl)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_22%]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-panel-2 text-faint">
            <User className="h-16 w-16" aria-hidden="true" />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgb(0 0 0 / 0.30), rgb(0 0 0 / 0.05) 45%, var(--panel))',
          }}
        />
        <div className="relative px-4 pb-5 md:px-8 md:pb-7">
          <div
            className="text-[13px] font-semibold text-paper"
            style={{ textShadow: '0 1px 8px rgb(0 0 0 / 0.5)' }}
          >
            {t('artistPage.eyebrow')}
          </div>
          <h1
            className="mt-1 text-4xl leading-[1.05] font-extrabold tracking-tight break-words text-paper md:text-6xl"
            style={{ textShadow: '0 2px 16px rgb(0 0 0 / 0.45)' }}
          >
            {name}
          </h1>
          {!resolving && !resolved && (
            <p className="mt-2 text-[13px] text-paper/80">{t('artistPage.noEntity')}</p>
          )}
        </div>
      </header>

      <div className="px-4 pt-5 md:px-8">
        {drill ? (
          <section>
            <button
              type="button"
              onClick={() => setDrill(null)}
              className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition hover:text-paper"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {drill.album.name ?? t('artistPage.back')}
            </button>
            <h2 className="mb-4 text-2xl font-bold text-paper">{t('artistPage.albumTracks')}</h2>
            <TrackList tracks={drill.tracks.map(searchTrackToRow)} />
          </section>
        ) : (
          <>
            {providerId && (
              <div className="mb-6 flex items-center gap-4 max-md:justify-end">
                <button
                  type="button"
                  disabled={!tracks || tracks.length === 0}
                  onClick={addAllTracks}
                  title={t('artistPage.addAll')}
                  aria-label={t('artistPage.addAll')}
                  className="grid h-12 w-12 place-items-center rounded-full bg-accent text-on-accent transition hover:scale-105 hover:brightness-105 disabled:opacity-40 disabled:hover:scale-100"
                >
                  <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true" />
                </button>
              </div>
            )}

            {providerId && (
              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-bold text-paper">{t('artistPage.tracks')}</h2>
                {tracks === null ? (
                  <p className="py-10 text-center text-sm text-muted">{t('common.loading')}</p>
                ) : tracks.length === 0 ? (
                  <p className="py-10 text-center text-sm text-faint">{t('artistPage.empty')}</p>
                ) : (
                  <>
                    <TrackList
                      tracks={(tracksExpanded ? tracks : tracks.slice(0, 5)).map(searchTrackToRow)}
                    />
                    {tracks.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setTracksExpanded((open) => !open)}
                        className="mt-2 px-4 text-[13px] font-semibold text-muted transition hover:text-paper"
                      >
                        {tracksExpanded ? t('artistPage.seeLess') : t('artistPage.seeMore')}
                      </button>
                    )}
                  </>
                )}
              </section>
            )}

            {providerId && albums !== null && albums.length > 0 && (
              <section className="mb-10">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-bold text-paper">{t('artistPage.albums')}</h2>
                  <Link
                    to={`/artist/${encodeURIComponent(name)}/discography?provider=${encodeURIComponent(providerId)}&entity=${encodeURIComponent(entityId ?? '')}`}
                    className="flex-none text-[13px] font-semibold text-muted transition hover:text-paper"
                  >
                    {t('artistPage.showAll')}
                  </Link>
                </div>
                {/* 定宽卡单行横滚（与首页 ShelfRow 同形态），全部作品进 Show All 页 */}
                <div className="no-scrollbar -mx-2 flex gap-2 overflow-x-auto px-2 pb-1">
                  {albums.map((album) => (
                    <button
                      key={album.entity_id}
                      type="button"
                      disabled={busy}
                      onClick={() => openAlbum(album)}
                      className="group block w-[180px] flex-none rounded-lg p-3 text-left transition-colors hover:bg-panel-2 disabled:opacity-40"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-md">
                        {album.cover_url ? (
                          <img
                            src={coverSrc(album.cover_url)}
                            alt={album.name ?? ''}
                            className="h-full w-full object-cover transition-shadow group-hover:shadow-[inset_0_0_0_1px_var(--rail)]"
                          />
                        ) : (
                          <span className="grid h-full w-full place-items-center bg-panel-2 text-faint">
                            <Disc3 className="h-7 w-7" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                      <div className="mt-3 truncate text-[15px] font-semibold text-paper">
                        {album.name}
                      </div>
                      {album.detail && (
                        <div className="mt-1 truncate text-[13px] text-muted">{album.detail}</div>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {resolved?.bio && (
              <section className="rounded-md bg-panel-2 px-5 py-4">
                <h2 className="mb-2 text-[15px] font-semibold text-paper">
                  {t('artistPage.about')}
                </h2>
                <p className="text-[13px] leading-6 whitespace-pre-line text-muted">
                  {resolved.bio}
                </p>
              </section>
            )}

            {!resolving && !resolved && (
              <p className="py-10 text-center text-sm text-faint">{t('artistPage.noContent')}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
