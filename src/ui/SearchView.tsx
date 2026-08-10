/**
 * 搜索页：顶栏搜索框的落点。URL 驱动（?q= &p=），无独立导航入口。
 * 分类 chips 由 provider 的 capabilities.search_categories 驱动——
 * 只渲染服务端报告的分类（能力不对称是正常状态，不占位造假）。
 * artist/album 实体可钻取为可入队曲目；playlist 实体走导入（media_admin）。
 */
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DropdownMenu } from 'radix-ui';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CirclePlus,
  Disc3,
  ListMusic,
  ListPlus,
  Radio,
  Search as SearchIcon,
  User,
} from 'lucide-react';
import type { SearchCategory, SearchEntity, SearchTrack } from '../api/types';
import { api, roomStore } from '../app/session';
import { useIdentity, useProviders, useRoomState } from './hooks';
import { coverSrc } from './cover';
import { formatMs } from './format';
import { composeSource, entityRadioSource } from './radioSources';
import { TrackList, useEnqueue, useTrackSelect, type TrackSelect } from './TrackList';
import { useToast } from './toast';
import { SEARCH_PROVIDER_KEY, useShell } from './AppShell';

type Chip = 'all' | SearchCategory;

const CHIP_KEYS: Record<Chip, string> = {
  all: 'searchPage.catAll',
  song: 'searchPage.catSongs',
  artist: 'searchPage.catArtists',
  album: 'searchPage.catAlbums',
  playlist: 'searchPage.catPlaylists',
};

interface DrillTarget {
  type: 'artist' | 'album';
  id: string;
  name: string;
  coverUrl?: string;
  detail?: string;
}

export default function SearchView(): JSX.Element {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const providers = useProviders();
  const query = params.get('q')?.trim() ?? '';
  const provider = params.get('p') || localStorage.getItem(SEARCH_PROVIDER_KEY) || 'ncm';
  const [mobileKeyword, setMobileKeyword] = useState(query);

  // 能力报告驱动 chips；未报告分类能力的 provider 只有单曲
  const supported: SearchCategory[] =
    providers?.find((p) => p.id === provider)?.capabilities?.search_categories ?? ['song'];
  const chips: Chip[] = ['all', ...supported];

  const [category, setCategory] = useState<Chip>('all');
  const [drill, setDrill] = useState<DrillTarget | null>(null);

  // 换词/换源：回全部、退出钻取；provider 不支持当前分类时同样回退
  useEffect(() => {
    setDrill(null);
    setCategory((current) =>
      current !== 'all' && !supported.includes(current) ? 'all' : current,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, provider]);

  return (
    <div className="view-enter px-4 pt-4 pb-10 md:px-8 md:pt-6">
      {/* 移动端输入框：顶栏搜索 icon 跳转到这里，页面自带输入（桌面端用顶栏输入框）。
          provider 切换折叠在框内左侧（与桌面顶栏同一交互） */}
      <form
        className="mb-5 flex items-center gap-2 rounded-full border border-hairline bg-panel px-3.5 py-2 md:hidden"
        onSubmit={(event) => {
          event.preventDefault();
          const q = mobileKeyword.trim();
          if (q) navigate(`/search?q=${encodeURIComponent(q)}&p=${encodeURIComponent(provider)}`);
        }}
      >
        {providers && providers.length > 1 && (
          <>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  title={t('searchPage.providerPick')}
                  className="flex flex-none items-center gap-1 font-mono text-[12px] text-muted hover:text-paper"
                >
                  {provider}
                  <ChevronDown className="h-3 w-3 text-faint" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="start"
                  sideOffset={8}
                  className="menu-content z-50 min-w-28 rounded-lg border border-hairline bg-panel-2 p-1.5"
                >
                  {providers.map((item) => (
                    <DropdownMenu.Item
                      key={item.id}
                      onSelect={() => {
                        localStorage.setItem(SEARCH_PROVIDER_KEY, item.id);
                        navigate(
                          query
                            ? `/search?q=${encodeURIComponent(query)}&p=${encodeURIComponent(item.id)}`
                            : `/search?p=${encodeURIComponent(item.id)}`,
                        );
                      }}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 font-mono text-[12.5px] text-muted outline-none data-[highlighted]:bg-[var(--hover)] data-[highlighted]:text-paper"
                    >
                      {item.id}
                      {item.id === provider && <Check className="h-3.5 w-3.5 text-accent" />}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <span className="h-4 w-px flex-none bg-hairline" />
          </>
        )}
        <SearchIcon className="h-3.5 w-3.5 flex-none text-faint" />
        <input
          value={mobileKeyword}
          onChange={(event) => setMobileKeyword(event.target.value)}
          placeholder={t('search.placeholder')}
          className="search-input w-full min-w-0 bg-transparent text-[13px] placeholder:text-faint focus:outline-none"
        />
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => {
              setCategory(chip);
              setDrill(null);
            }}
            className={`rounded-full px-3.5 py-1.5 text-[13.5px] transition-colors ${
              category === chip && drill === null
                ? 'bg-paper text-hall'
                : 'bg-panel-2 text-paper hover:bg-[var(--hover)]'
            }`}
          >
            {t(CHIP_KEYS[chip])}
          </button>
        ))}
      </div>

      {!query && <p className="py-16 text-center text-sm text-muted">{t('searchPage.noQuery')}</p>}

      {query && drill !== null && (
        <EntityDrill provider={provider} drill={drill} onBack={() => setDrill(null)} onDrill={setDrill} />
      )}

      {query &&
        drill === null &&
        (category === 'all' ? (
          <AllResults provider={provider} query={query} supported={supported} onDrill={setDrill} />
        ) : category === 'song' ? (
          <SongResults provider={provider} query={query} />
        ) : (
          <EntitySection provider={provider} query={query} category={category} onDrill={setDrill} />
        ))}
    </div>
  );
}

// ---------- 单曲结果（真实检索，分页） ----------

const PAGE_SIZE = 30;

type EntityCategory = Exclude<SearchCategory, 'song'>;

interface EntityHit {
  category: EntityCategory;
  entity: SearchEntity;
}

const ALL_ENTITY_LIMIT = 6;

function AllResults({
  provider,
  query,
  supported,
  onDrill,
}: {
  provider: string;
  query: string;
  supported: SearchCategory[];
  onDrill: (target: DrillTarget) => void;
}) {
  const { t } = useTranslation();
  const { showError } = useToast();
  const enqueue = useEnqueue();
  const select = useTrackSelect();
  const actions = useEntityActions(provider, onDrill);
  const [tracks, setTracks] = useState<SearchTrack[] | null>(null);
  const [entities, setEntities] = useState<EntityHit[] | null>(null);
  const entityCategories = supported.filter(
    (category): category is EntityCategory => category !== 'song',
  );
  const entityCategoryKey = entityCategories.join(',');
  const supportsSongs = supported.includes('song');

  useEffect(() => {
    setTracks(null);
    setEntities(null);
    select.clear();
    let dead = false;

    if (supportsSongs) {
      api
        .search(provider, query, { limit: 4 })
        .then((list) => {
          if (!dead) setTracks(list);
        })
        .catch((error: unknown) => {
          if (!dead) {
            setTracks([]);
            showError(error);
          }
        });
    } else {
      setTracks([]);
    }

    void Promise.all(
      entityCategories.map(async (category) => {
        try {
          const list = await api.searchCategory(provider, query, category, {
            limit: ALL_ENTITY_LIMIT,
          });
          return list.map((entity): EntityHit => ({ category, entity }));
        } catch {
          return [];
        }
      }),
    ).then((groups) => {
      if (!dead) setEntities(groups.flat());
    });

    return () => {
      dead = true;
    };
    // entityCategoryKey is the stable capability signature; the array itself is recreated per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, query, entityCategoryKey, supportsSongs, showError]);

  if (tracks === null || entities === null) {
    return <p className="py-6 text-sm text-muted">{t('common.loading')}</p>;
  }

  const topEntityIndex = entities.findIndex(({ entity }) => Boolean(entity.entity_id));
  const topEntity = topEntityIndex >= 0 ? entities[topEntityIndex] : undefined;
  const topTrack = topEntity ? undefined : tracks[0];
  const remainingEntities = entities.filter((_, index) => index !== topEntityIndex);

  if (!topEntity && !topTrack) {
    return <p className="py-12 text-sm text-faint">{t('search.empty')}</p>;
  }

  return (
    <div className="space-y-9">
      {select.menuNode}
      {select.fabNode}

      <section>
        <h2 className="mb-3 text-2xl font-bold text-paper">{t('searchPage.topResult')}</h2>
        <TopResultCard hit={topEntity} track={topTrack} actions={actions} />
      </section>

      {supportsSongs && tracks.length > 0 && (
        <CompactSongs
          tracks={tracks}
          select={select}
          onQuickAdd={(track) => enqueue([track.track_ref], track.title)}
        />
      )}

      {remainingEntities.length > 0 && (
        <section>
          <h2 className="mb-3 text-2xl font-bold text-paper">{t('searchPage.moreEntities')}</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {remainingEntities.map((hit) => (
              <EntityCard
                key={`${hit.category}:${hit.entity.entity_id ?? hit.entity.name}`}
                hit={hit}
                actions={actions}
                className="w-40 flex-none md:w-44"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CompactSongs({
  tracks,
  select,
  onQuickAdd,
}: {
  tracks: SearchTrack[];
  select: TrackSelect;
  onQuickAdd: (track: SearchTrack) => void;
}) {
  const { t } = useTranslation();

  return (
    <section>
      <h2 className="mb-3 text-2xl font-bold text-paper">{t('searchPage.catSongs')}</h2>
      <div>
        {tracks.slice(0, 4).map((track) => {
          const selected = select.selectedRefs.has(track.track_ref);
          return (
            <div
              key={track.track_ref}
              tabIndex={0}
              {...select.rowProps(track)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (event.ctrlKey || event.metaKey) select.toggle(track.track_ref);
                  else onQuickAdd(track);
                }
              }}
              className={`grid cursor-pointer grid-cols-[40px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md px-2 py-2 transition-colors select-none ${
                selected ? 'bg-panel-2' : 'hover:bg-[var(--hover)]'
              }`}
            >
              <img
                src={coverSrc(
                  track.cover_url || `/api/v1/cover/${encodeURIComponent(track.track_ref)}`,
                )}
                alt={track.title}
                className="h-10 w-10 rounded-md object-cover"
              />
              <div className="min-w-0">
                <div className="truncate text-[14px] text-paper">{track.title}</div>
                <div className="truncate text-[13px] text-muted">{track.artist}</div>
              </div>
              <span className="text-[12px] text-muted tabular-nums">{formatMs(track.duration_ms)}</span>
              <button
                type="button"
                title={t('searchPage.quickAdd', { title: track.title })}
                aria-label={t('searchPage.quickAdd', { title: track.title })}
                onClick={(event) => {
                  event.stopPropagation();
                  onQuickAdd(track);
                }}
                className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-panel-2 hover:text-paper"
              >
                <CirclePlus className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}


function SongResults({ provider, query }: { provider: string; query: string }) {
  const { t } = useTranslation();
  const { showError } = useToast();
  const [results, setResults] = useState<SearchTrack[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setResults(null);
    let dead = false;
    setBusy(true);
    api
      .search(provider, query, { limit: PAGE_SIZE })
      .then((tracks) => {
        if (!dead) setResults(tracks);
      })
      .catch((err: unknown) => {
        if (!dead) {
          setResults([]);
          showError(err);
        }
      })
      .finally(() => {
        if (!dead) setBusy(false);
      });
    return () => {
      dead = true;
    };
  }, [query, provider, showError]);

  const loadMore = () => {
    if (!results || loadingMore) return;
    setLoadingMore(true);
    api
      .search(provider, query, { limit: PAGE_SIZE, offset: results.length })
      .then((more) => setResults((current) => [...(current ?? []), ...more]))
      .catch(showError)
      .finally(() => setLoadingMore(false));
  };

  return (
    <section>
      <h2 className="mt-8 mb-4 text-2xl font-bold text-paper first:mt-0">
        {t('searchPage.catSongs')}
      </h2>
      {busy && <p className="py-6 text-sm text-muted">{t('common.loading')}</p>}
      {!busy && results?.length === 0 && <p className="py-6 text-sm text-faint">{t('search.empty')}</p>}
      {!busy && results && results.length > 0 && (
        <TrackList
          tracks={results}
          onLoadMore={results.length % PAGE_SIZE === 0 ? loadMore : undefined}
          loadingMore={loadingMore}
        />
      )}
    </section>
  );
}

// ---------- 分类实体（歌手/专辑/歌单） ----------

const ENTITY_ICONS = { artist: User, album: Disc3, playlist: ListMusic } as const;

function EntitySection({
  provider,
  query,
  category,
  onDrill,
}: {
  provider: string;
  query: string;
  category: EntityCategory;
  onDrill: (target: DrillTarget) => void;
}) {
  const { t } = useTranslation();
  const { showError } = useToast();
  const actions = useEntityActions(provider, onDrill);
  const [results, setResults] = useState<SearchEntity[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setResults(null);
    let dead = false;
    api
      .searchCategory(provider, query, category, { limit: PAGE_SIZE })
      .then((entities) => {
        if (!dead) setResults(entities);
      })
      .catch(() => {
        if (!dead) setResults([]);
      });
    return () => {
      dead = true;
    };
  }, [query, provider, category]);

  const loadMore = () => {
    if (!results || loadingMore) return;
    setLoadingMore(true);
    api
      .searchCategory(provider, query, category, { limit: PAGE_SIZE, offset: results.length })
      .then((more) => setResults((current) => [...(current ?? []), ...more]))
      .catch(showError)
      .finally(() => setLoadingMore(false));
  };

  if (results === null) {
    return <p className="py-6 text-sm text-muted">{t('common.loading')}</p>;
  }

  if (results.length === 0) {
    return <p className="py-6 text-sm text-faint">{t('search.empty')}</p>;
  }

  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold text-paper">{t(CHIP_KEYS[category])}</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
        {results.map((entity) => (
          <EntityCard
            key={`${category}:${entity.entity_id ?? entity.name}`}
            hit={{ category, entity }}
            actions={actions}
          />
        ))}
      </div>
      {results.length % PAGE_SIZE === 0 && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-4 w-full rounded-full bg-panel-2 py-2.5 text-[13px] font-semibold text-paper transition hover:bg-[var(--hover)] disabled:opacity-40"
        >
          {loadingMore ? t('common.loading') : t('searchPage.loadMore')}
        </button>
      )}
    </section>
  );
}

interface EntityActions {
  canImport: boolean;
  canPlayAsRadio: boolean;
  importBusy: boolean;
  playlistDisabled: boolean;
  open: (hit: EntityHit) => void;
  importEntity: (entity: SearchEntity) => void;
  playAsRadio: (entity: SearchEntity) => void;
}

function useEntityActions(
  provider: string,
  onDrill: (target: DrillTarget) => void,
): EntityActions {
  const { t } = useTranslation();
  const { show, showError } = useToast();
  const navigate = useNavigate();
  const identity = useIdentity();
  const state = useRoomState();
  const providers = useProviders();
  const { canRadio, setRoomsOpen } = useShell();
  const [importBusy, setImportBusy] = useState(false);
  const canImport = identity?.roles.includes('media_admin') ?? false;
  const radioSource = entityRadioSource(providers, provider);

  const importEntity = (entity: SearchEntity) => {
    if (!entity.entity_id || !canImport || importBusy) return;
    setImportBusy(true);
    void api
      .importPlaylist({ provider, playlist_id: entity.entity_id })
      .then((playlist) => {
        show(t('searchPage.imported', { name: playlist.name }));
        navigate(`/playlist/${encodeURIComponent(playlist.id)}`);
      })
      .catch(showError)
      .finally(() => setImportBusy(false));
  };

  const playAsRadio = (entity: SearchEntity) => {
    if (!entity.entity_id || !radioSource) return;
    if (!state.roomId) {
      show(t('home.needRoom'));
      setRoomsOpen(true);
      return;
    }
    if (!canRadio) {
      show(t('home.radioNeedControl'));
      return;
    }
    const source = composeSource(provider, radioSource, undefined, entity.entity_id);
    if (!source) return;
    void roomStore
      .radioPlay(source)
      .then(() => show(t('roomAdmin.radioStarted')))
      .catch(showError);
  };

  const open = (hit: EntityHit) => {
    const { category, entity } = hit;
    if (!entity.entity_id) return;
    if (category === 'playlist') {
      if (radioSource) playAsRadio(entity);
      else importEntity(entity);
      return;
    }
    onDrill({
      type: category,
      id: entity.entity_id,
      name: entity.name ?? '',
      coverUrl: entity.cover_url,
      detail: entity.detail,
    });
  };

  return {
    canImport,
    canPlayAsRadio: Boolean(radioSource),
    importBusy,
    playlistDisabled: !radioSource && !canImport,
    open,
    importEntity,
    playAsRadio,
  };
}

function EntityCard({
  hit,
  actions,
  className = '',
}: {
  hit: EntityHit;
  actions: EntityActions;
  className?: string;
}) {
  const { t } = useTranslation();
  const { category, entity } = hit;
  const Icon = ENTITY_ICONS[category];
  const dead = !entity.entity_id || (category === 'playlist' && actions.playlistDisabled);

  return (
    <article
      role="button"
      tabIndex={dead ? -1 : 0}
      aria-disabled={dead}
      title={dead && category === 'playlist' ? t('searchPage.importNeedAdmin') : undefined}
      onClick={() => {
        if (!dead) actions.open(hit);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (!dead && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          actions.open(hit);
        }
      }}
      className={`group rounded-lg bg-[var(--hover)] p-3 text-left transition-colors hover:bg-panel-2 ${
        dead ? 'opacity-50' : 'cursor-pointer'
      } ${className}`}
    >
      <div className="relative aspect-square w-full">
        {entity.cover_url ? (
          <img
            src={coverSrc(entity.cover_url)}
            alt={entity.name ?? ''}
            className={`h-full w-full object-cover ${
              category === 'artist' ? 'rounded-full' : 'rounded-md'
            }`}
          />
        ) : (
          <div
            className={`grid h-full w-full place-items-center bg-panel-2 text-faint ${
              category === 'artist' ? 'rounded-full' : 'rounded-md'
            }`}
          >
            <Icon className="h-9 w-9" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="mt-3 truncate text-[15px] font-semibold text-paper">{entity.name}</div>
      {entity.detail && (
        <div className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{entity.detail}</div>
      )}
      {category === 'playlist' && (actions.canPlayAsRadio || actions.canImport) && (
        <div className="mt-2 flex gap-1">
          {actions.canPlayAsRadio && (
            <button
              type="button"
              title={t('searchPage.playAsRadio')}
              onClick={(event) => {
                event.stopPropagation();
                actions.playAsRadio(entity);
              }}
              className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-[var(--hover)] hover:text-paper"
            >
              <Radio className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {actions.canImport && (
            <button
              type="button"
              title={t('searchPage.importAction')}
              disabled={actions.importBusy}
              onClick={(event) => {
                event.stopPropagation();
                actions.importEntity(entity);
              }}
              className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-[var(--hover)] hover:text-paper disabled:opacity-40"
            >
              <ListPlus className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function TopResultCard({
  hit,
  track,
  actions,
}: {
  hit?: EntityHit;
  track?: SearchTrack;
  actions: EntityActions;
}) {
  const { t } = useTranslation();
  const enqueue = useEnqueue();
  if (!hit && !track) return null;

  const category: SearchCategory = hit?.category ?? 'song';
  const entity = hit?.entity;
  const Icon = category === 'song' ? Disc3 : ENTITY_ICONS[category];
  const name = entity?.name ?? track?.title ?? '';
  const detail = entity?.detail ?? track?.artist;
  const coverUrl = entity?.cover_url ?? track?.cover_url;
  const dead = hit
    ? !entity?.entity_id || (category === 'playlist' && actions.playlistDisabled)
    : false;

  const activate = () => {
    if (hit) actions.open(hit);
    // 单曲 Top Result：大卡是单一动作面，点击 = 直接入队（不走选择模型）
    else if (track) enqueue([track.track_ref], track.title);
  };

  return (
    <article
      role="button"
      aria-disabled={dead || undefined}
      tabIndex={dead ? -1 : 0}
      title={
        dead && category === 'playlist'
          ? t('searchPage.importNeedAdmin')
          : track
            ? t('search.add')
            : undefined
      }
      onClick={() => {
        if (!dead) activate();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (!dead && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          activate();
        }
      }}
      className={`flex min-h-36 items-center gap-5 rounded-lg bg-[var(--hover)] p-5 text-left transition-colors hover:bg-panel-2 ${
        dead ? 'opacity-50' : 'cursor-pointer'
      }`}
    >
      {coverUrl ? (
        <img
          src={
            track
              ? coverSrc(track.cover_url || `/api/v1/cover/${encodeURIComponent(track.track_ref)}`)
              : coverSrc(coverUrl)
          }
          alt={name}
          className={`h-[92px] w-[92px] flex-none object-cover ${
            category === 'artist' ? 'rounded-full' : 'rounded-md'
          }`}
        />
      ) : (
        <div
          className={`grid h-[92px] w-[92px] flex-none place-items-center bg-panel-2 text-faint ${
            category === 'artist' ? 'rounded-full' : 'rounded-md'
          }`}
        >
          <Icon className="h-9 w-9" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-2xl leading-tight font-bold text-paper">{name}</div>
        {detail && <div className="mt-1 truncate text-[13px] text-muted">{detail}</div>}
        <span className="mt-3 inline-flex rounded-full bg-hall px-2.5 py-1 text-[12px] text-paper">
          {t(CHIP_KEYS[category])}
        </span>
      </div>
      {category === 'playlist' && entity && (
        <div className="flex flex-none gap-1 self-end">
          {actions.canPlayAsRadio && (
            <button
              type="button"
              title={t('searchPage.playAsRadio')}
              onClick={(event) => {
                event.stopPropagation();
                actions.playAsRadio(entity);
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-hall hover:text-paper"
            >
              <Radio className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {actions.canImport && (
            <button
              type="button"
              title={t('searchPage.importAction')}
              disabled={actions.importBusy}
              onClick={(event) => {
                event.stopPropagation();
                actions.importEntity(entity);
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-hall hover:text-paper disabled:opacity-40"
            >
              <ListPlus className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </article>
  );
}

// ---------- 实体钻取（artist/album → Spotify 式艺人/专辑页） ----------

/** 歌手页「专辑」区块：into=albums 实体列表，点击再钻到专辑曲目（终点归一）。 */
function AlbumGrid({
  provider,
  artistId,
  onDrill,
}: {
  provider: string;
  artistId: string;
  onDrill: (target: DrillTarget) => void;
}) {
  const { t } = useTranslation();
  const { showError } = useToast();
  const [albums, setAlbums] = useState<SearchEntity[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setAlbums(null);
    let dead = false;
    api
      .searchEntityAlbums(provider, artistId, { limit: PAGE_SIZE })
      .then((list) => {
        if (!dead) setAlbums(list);
      })
      .catch(() => {
        if (!dead) setAlbums([]);
      });
    return () => {
      dead = true;
    };
  }, [provider, artistId]);

  const loadMore = () => {
    if (!albums || loadingMore) return;
    setLoadingMore(true);
    api
      .searchEntityAlbums(provider, artistId, { limit: PAGE_SIZE, offset: albums.length })
      .then((more) => setAlbums((current) => [...(current ?? []), ...more]))
      .catch(showError)
      .finally(() => setLoadingMore(false));
  };

  if (albums === null) return <p className="py-6 text-sm text-muted">{t('common.loading')}</p>;
  if (albums.length === 0) return <p className="py-6 text-sm text-faint">{t('search.empty')}</p>;

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
        {albums.map((album) => (
          <button
            key={album.entity_id ?? album.name}
            type="button"
            disabled={!album.entity_id}
            onClick={() =>
              onDrill({
                type: 'album',
                id: album.entity_id!,
                name: album.name ?? '',
                coverUrl: album.cover_url,
                detail: album.detail,
              })
            }
            className="group rounded-lg bg-[var(--hover)] p-3 text-left transition-colors hover:bg-panel-2 disabled:opacity-40"
          >
            {album.cover_url ? (
              <img
                src={coverSrc(album.cover_url)}
                alt={album.name ?? ''}
                className="aspect-square w-full rounded-md object-cover"
              />
            ) : (
              <span className="grid aspect-square w-full place-items-center rounded-md bg-panel-2 text-faint">
                <Disc3 className="h-8 w-8" aria-hidden="true" />
              </span>
            )}
            <div className="mt-3 line-clamp-2 text-[15px] leading-snug font-semibold text-paper">{album.name}</div>
            {album.detail && <div className="mt-1 line-clamp-2 text-[13px] text-muted">{album.detail}</div>}
          </button>
        ))}
      </div>
      {albums.length % PAGE_SIZE === 0 && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-4 w-full rounded-full bg-panel-2 py-2.5 text-[13px] font-semibold text-paper transition hover:bg-[var(--hover)] disabled:opacity-40"
        >
          {loadingMore ? t('common.loading') : t('searchPage.loadMore')}
        </button>
      )}
    </div>
  );
}

function EntityDrill({
  provider,
  drill,
  onBack,
  onDrill,
}: {
  provider: string;
  drill: DrillTarget;
  onBack: () => void;
  onDrill: (target: DrillTarget) => void;
}) {
  const { t } = useTranslation();
  const { showError } = useToast();
  const enqueue = useEnqueue();
  const providers = useProviders();
  const [tracks, setTracks] = useState<SearchTrack[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // 歌手页视图：热门曲目 / 专辑（后者仅当 provider 报告 entity_albums 能力）
  const supportsAlbums =
    drill.type === 'artist' &&
    (providers?.find((p) => p.id === provider)?.capabilities?.entity_albums ?? false);
  const [view, setView] = useState<'tracks' | 'albums'>('tracks');

  useEffect(() => {
    setTracks(null);
    setView('tracks');
    let dead = false;
    api
      .searchEntity(provider, drill.type, drill.id, { limit: PAGE_SIZE })
      .then((list) => {
        if (!dead) setTracks(list);
      })
      .catch((err: unknown) => {
        if (!dead) {
          setTracks([]);
          showError(err);
        }
      });
    return () => {
      dead = true;
    };
  }, [provider, drill, showError]);

  const loadMore = () => {
    if (!tracks || loadingMore) return;
    setLoadingMore(true);
    api
      .searchEntity(provider, drill.type, drill.id, { limit: PAGE_SIZE, offset: tracks.length })
      .then((more) => setTracks((current) => [...(current ?? []), ...more]))
      .catch(showError)
      .finally(() => setLoadingMore(false));
  };

  return (
    <section>
      <button
        type="button"
        onClick={onBack}
        title={t('searchPage.backResults')}
        aria-label={t('searchPage.backResults')}
        className="mb-5 grid h-9 w-9 place-items-center rounded-full bg-panel-2 text-muted transition hover:bg-[var(--hover)] hover:text-paper"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="mb-8 flex items-center gap-5">
        {drill.coverUrl ? (
          <img
            src={coverSrc(drill.coverUrl)}
            alt={drill.name}
            className={`h-[92px] w-[92px] flex-none object-cover ${
              drill.type === 'artist' ? 'rounded-full' : 'rounded-md'
            }`}
            style={{ boxShadow: 'var(--cover-shadow)' }}
          />
        ) : (
          <div
            className={`grid h-[92px] w-[92px] flex-none place-items-center bg-panel-2 text-faint ${
              drill.type === 'artist' ? 'rounded-full' : 'rounded-md'
            }`}
          >
            {drill.type === 'artist' ? (
              <User className="h-9 w-9" aria-hidden="true" />
            ) : (
              <Disc3 className="h-9 w-9" aria-hidden="true" />
            )}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-muted">
            {t(drill.type === 'artist' ? 'searchPage.catArtists' : 'searchPage.catAlbums')}
          </div>
          <h2 className="mt-1 line-clamp-2 text-4xl leading-none font-bold tracking-tight text-paper md:text-5xl">
            {drill.name}
          </h2>
          {drill.detail && <div className="mt-2 line-clamp-2 text-[13px] text-muted">{drill.detail}</div>}
          {tracks && tracks.length > 0 && (
            <button
              type="button"
              onClick={() => enqueue(tracks.map((track) => track.track_ref))}
              className="mt-3 rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-on-accent transition hover:brightness-105"
            >
              {t('batch.addPlaylist')}
            </button>
          )}
        </div>
      </div>

      {supportsAlbums && (
        <div className="mb-4 flex gap-1 border-b border-hairline">
          {(['tracks', 'albums'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`-mb-px border-b-2 px-3.5 py-2 text-[13.5px] transition-colors ${
                view === v
                  ? 'border-accent text-paper'
                  : 'border-transparent text-muted hover:text-paper'
              }`}
            >
              {t(v === 'tracks' ? 'searchPage.popularTracks' : 'searchPage.albumsTab')}
            </button>
          ))}
        </div>
      )}

      {view === 'albums' ? (
        <AlbumGrid provider={provider} artistId={drill.id} onDrill={onDrill} />
      ) : (
        <>
          {!supportsAlbums && (
            <h3 className="mb-4 text-2xl font-bold text-paper">
              {t(drill.type === 'artist' ? 'searchPage.popularTracks' : 'searchPage.tracksTitle')}
            </h3>
          )}
          {tracks === null && <p className="py-6 text-sm text-muted">{t('common.loading')}</p>}
          {tracks?.length === 0 && <p className="py-6 text-sm text-faint">{t('search.empty')}</p>}
          {tracks && tracks.length > 0 && (
            <TrackList
              tracks={tracks}
              onLoadMore={tracks.length % PAGE_SIZE === 0 ? loadMore : undefined}
              loadingMore={loadingMore}
            />
          )}
        </>
      )}
    </section>
  );
}
