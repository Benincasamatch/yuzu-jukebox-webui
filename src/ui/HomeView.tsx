/**
 * 首页 = 漫游区：推荐 feed、源目录驱动的电台与集合、全局热门、最近播放和本房热门。
 * 封面 shelf 一律单行横向滚动、只摆第一分页；「显示全部」跳 /shelf/:kind 全览页。
 */
import { useEffect, useState, type JSX, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import type {
  HistoryEntry,
  HotTrack,
  RecommendationShelf,
  SearchTrack,
  StatsEntry,
} from '../api/types';
import { api, roomStore } from '../app/session';
import { ActivityCard } from './ActivityCard';
import { coverSrc } from './cover';
import { CoverThumb } from './CoverThumb';
import { formatClock } from './format';
import { useIdentity, useProviders, useRoomState } from './hooks';
import { SOURCE_DESC_KEYS } from './radioSources';
import { useToast } from './toast';
import { useEnqueue } from './TrackList';
import { useShell } from './AppShell';

export default function HomeView(): JSX.Element {
  const { t } = useTranslation();
  const identity = useIdentity();

  return (
    <div className="view-enter px-4 pt-4 pb-10 md:px-8 md:pt-6">
      <h1 className="text-[32px] font-bold text-paper">
        {t('lobby.greeting', { period: t(greetingKey()), name: identity?.name ?? '' })}
      </h1>

      <RecommendationSection />
      <RadioSection />
      <HotSection />
      <RecentSection />
      <RoomActivitySections />
    </div>
  );
}

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 5) return 'lobby.periodNight';
  if (h < 12) return 'lobby.periodMorning';
  if (h < 14) return 'lobby.periodNoon';
  if (h < 18) return 'lobby.periodAfternoon';
  return 'lobby.periodEvening';
}

function ShelfHeader({
  title,
  actionLabel,
  actionDisabled = false,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
}): JSX.Element {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-2xl font-bold text-paper">{title}</h2>
      {actionLabel && onAction && (
        <button
          type="button"
          disabled={actionDisabled}
          onClick={onAction}
          className="text-[13px] font-semibold text-muted hover:underline disabled:opacity-40"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

const shelfGridClass = 'grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5';
const collectionCardClass =
  'rounded-lg bg-[var(--hover)] p-4 text-left transition-colors hover:bg-panel-2 disabled:opacity-40';

/** 封面 shelf 单行：定宽卡片横向滚动（Spotify 首页行形态），卡宽由卡片 className 控制。 */
function ShelfRow({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="no-scrollbar -mx-2 flex gap-2 overflow-x-auto px-2 pb-1">{children}</div>
  );
}

// ---------- 为你推荐（服务端推荐 feed） ----------

function RecommendationSection(): JSX.Element | null {
  const { t } = useTranslation();
  const { showError } = useToast();
  const enqueue = useEnqueue();
  const [shelves, setShelves] = useState<RecommendationShelf[] | null>(null);

  useEffect(() => {
    let dead = false;
    api
      .recommendations()
      .then((result) => {
        if (!dead) setShelves(result);
      })
      .catch((error: unknown) => {
        if (dead) return;
        setShelves([]);
        showError(error);
      });
    return () => {
      dead = true;
    };
  }, [showError]);

  if (shelves === null) {
    return <p className="mt-10 text-sm text-muted">{t('home.recommendationsLoading')}</p>;
  }

  const populatedShelves = shelves.filter((shelf) => shelf.tracks.length > 0);
  if (populatedShelves.length === 0) return null;

  return (
    <>
      {populatedShelves.map((shelf) => (
        <section key={shelf.id} className="mt-10">
          <ShelfHeader
            title={shelf.title}
            actionLabel={t('home.addShelf')}
            onAction={() => enqueue(shelf.tracks.map((track) => track.track_ref))}
          />
          <ShelfRow>
            {shelf.tracks.map((track) => (
              <RecommendationCard key={track.track_ref} track={track} onEnqueue={enqueue} />
            ))}
          </ShelfRow>
        </section>
      ))}
    </>
  );
}

function RecommendationCard({
  track,
  onEnqueue,
}: {
  track: SearchTrack;
  onEnqueue: (refs: string[], toastTitle?: string) => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      title={t('home.addTrack', { title: track.title })}
      onClick={() => onEnqueue([track.track_ref], track.title)}
      className="group block w-[180px] flex-none rounded-lg p-3 text-left transition-colors hover:bg-panel-2"
    >
      <div className="relative aspect-square w-full rounded-md transition-shadow group-hover:shadow-[inset_0_0_0_1px_var(--rail)]">
        <CoverThumb
          src={coverSrc(
            track.cover_url || `/api/v1/cover/${encodeURIComponent(track.track_ref)}`,
          )}
          alt={track.title}
          className="h-full w-full rounded-md"
        />
        <span
          aria-hidden="true"
          className="absolute right-2 bottom-2 grid h-12 w-12 translate-y-2 place-items-center rounded-full bg-accent text-on-accent opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
        >
          <Play className="h-5 w-5 fill-current" />
        </span>
      </div>
      <div className="mt-3 truncate text-[15px] font-semibold text-paper">{track.title}</div>
      <div className="mt-1 line-clamp-2 text-[13px] text-muted">{track.artist}</div>
    </button>
  );
}

// ---------- 随便听听（源目录驱动，按语义分组） ----------

function RadioSection(): JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = useRoomState();
  const { canRadio, setRoomsOpen } = useShell();
  const providers = useProviders();
  const { show, showError } = useToast();
  const [busy, setBusy] = useState(false);
  const catalog = (providers ?? []).flatMap((p) =>
    (p.capabilities?.radio_sources ?? []).map((source) => ({
      providerId: p.id,
      source,
      credentialOk: p.credential_status === 'ok',
      owned: p.owned === true,
    })),
  );

  // finite 无参源是定期刷新的曲目集合，进入集合页；无限流才直接启动电台。
  // simi 由播放控制区提供；带参源在首页没有参数上下文，不陈列。
  const collections = catalog.filter((entry) => entry.source.finite && !entry.source.arg);
  const radios = catalog.filter(
    (entry) => !entry.source.finite && entry.source.spec !== 'simi',
  );

  const start = (source: string) => {
    if (!state.roomId) {
      show(t('home.needRoom'));
      setRoomsOpen(true);
      return;
    }
    if (!canRadio) {
      show(t('home.radioNeedControl'));
      return;
    }
    if (busy) return;
    setBusy(true);
    void roomStore
      .radioPlay(source)
      .then(() => show(t('roomAdmin.radioStarted')))
      .catch(showError)
      .finally(() => setBusy(false));
  };

  if (collections.length === 0 && radios.length === 0) return null;

  return (
    <>
      {collections.length > 0 && (
        <section className="mt-10">
          <ShelfHeader title={t('home.collectionsTitle')} />
          <div className={shelfGridClass}>
            {collections.map(({ providerId, source, credentialOk }) => {
              const usable = !source.requires_credential || credentialOk;
              const descKey = SOURCE_DESC_KEYS[source.spec];
              return (
                <button
                  key={`${providerId}:${source.spec}`}
                  type="button"
                  disabled={!usable}
                  title={usable ? undefined : t('radio.credentialNeed')}
                  onClick={() =>
                    navigate(`/source/${encodeURIComponent(`${providerId}:${source.spec}`)}`)
                  }
                  className={collectionCardClass}
                >
                  <div className="text-[15px] font-semibold text-paper">
                    {source.name ?? source.spec}
                  </div>
                  {descKey && (
                    <div className="mt-1 text-[13px] text-muted">{t(descKey)}</div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {radios.length > 0 && (
        <section className="mt-10">
          <ShelfHeader title={t('home.radioTitle')} />
          <div className={shelfGridClass}>
            {radios.map(({ providerId, source, credentialOk, owned }) => {
              const usable = !source.requires_credential || credentialOk;
              // 心动模式绑定凭据账号的喜欢列表：非 owner 可开，但先说明基底是谁的口味。
              const descKey =
                source.spec === 'heart' && source.requires_credential && !owned
                  ? 'radio.heartBoundHint'
                  : SOURCE_DESC_KEYS[source.spec];
              return (
                <button
                  key={`${providerId}:${source.spec}`}
                  type="button"
                  disabled={busy || !usable}
                  title={usable ? undefined : t('radio.credentialNeed')}
                  onClick={() => start(`${providerId}:${source.spec}`)}
                  className={collectionCardClass}
                >
                  <div className="text-[15px] font-semibold text-paper">
                    {source.name ?? source.spec}
                  </div>
                  {descKey && (
                    <div className="mt-1 text-[13px] text-muted">{t(descKey)}</div>
                  )}
                </button>
              );
            })}
          </div>
          {state.roomId && !canRadio && (
            <p className="mt-2 text-[11px] text-faint">{t('home.radioNeedControl')}</p>
          )}
        </section>
      )}
    </>
  );
}

// ---------- 全局热门（跨房间 play_history 聚合；首页只陈列第一分页单行） ----------

const HOT_PAGE_SIZE = 8;

function HotSection(): JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [hot, setHot] = useState<HotTrack[] | null>(null);

  useEffect(() => {
    let dead = false;
    api
      .hotTracks(7, HOT_PAGE_SIZE)
      .then((rows) => {
        if (!dead) setHot(rows);
      })
      .catch(() => {
        // 无 requester 角色等拒绝：区块静默隐藏。
        if (!dead) setHot([]);
      });
    return () => {
      dead = true;
    };
  }, []);

  if (!hot || hot.length === 0) return null;

  // 首页只摆第一分页；「显示全部」= 跳转全览页，分页加载在全览页进行
  const hasMore = hot.length >= HOT_PAGE_SIZE;
  return (
    <section className="mt-10">
      <ShelfHeader
        title={t('home.hotTitle')}
        actionLabel={hasMore ? t('home.showAll') : undefined}
        onAction={hasMore ? () => navigate('/shelf/hot') : undefined}
      />
      <ShelfRow>
        {hot.map((entry) => (
          <ActivityCard
            className="w-[180px] flex-none"
            key={entry.track_ref}
            trackRef={entry.track_ref}
            title={entry.title}
            meta={t('home.playCount', { count: entry.play_count })}
          />
        ))}
      </ShelfRow>
    </section>
  );
}

// ---------- 最近播放（个人跨房间历史） ----------

function RecentSection(): JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    let dead = false;
    api
      .myHistory(0, 10)
      .then((rows) => {
        if (!dead) setHistory(rows);
      })
      .catch(() => {
        // 无 requester 角色等拒绝：与全局热门相同，区块静默隐藏。
        if (!dead) setHistory([]);
      });
    return () => {
      dead = true;
    };
  }, []);

  if (!history || history.length === 0) return null;

  return (
    <section className="mt-10">
      <ShelfHeader
        title={t('home.recentTitle')}
        actionLabel={t('home.showAll')}
        onAction={() => navigate('/shelf/recent')}
      />
      <ShelfRow>
        {history.map((entry) => (
          <ActivityCard
            className="w-[180px] flex-none"
            key={`${entry.track_ref}:${entry.ended_at}`}
            trackRef={entry.track_ref}
            title={entry.title}
            meta={t('home.playedAt', { time: formatClock(entry.ended_at) })}
          />
        ))}
      </ShelfRow>
    </section>
  );
}

// ---------- 本房热门 ----------

function RoomActivitySections(): JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = useRoomState();
  const [stats, setStats] = useState<StatsEntry[] | null>(null);
  const roomId = state.roomId;

  useEffect(() => {
    setStats(null);
    if (!roomId) return;
    let dead = false;
    api
      .roomStats(roomId, 8)
      .then((rows) => !dead && setStats(rows))
      .catch(() => !dead && setStats([]));
    return () => {
      dead = true;
    };
  }, [roomId]);

  if (!roomId || !stats || stats.length === 0) return null;

  return (
    <section className="mt-10">
      <ShelfHeader
        title={t('home.statsTitle')}
        actionLabel={t('home.showAll')}
        onAction={() => navigate('/shelf/room')}
      />
      <ShelfRow>
        {stats.map((entry) => (
          <ActivityCard
            className="w-[180px] flex-none"
            key={entry.track_ref}
            trackRef={entry.track_ref}
            title={entry.title}
            meta={t('home.playCount', { count: entry.play_count })}
          />
        ))}
      </ShelfRow>
    </section>
  );
}
