/**
 * 首页 = 漫游区：榜单（聚合电台目录）、源目录驱动的电台与集合、全局热门、最近播放和本房热门。
 * 封面 shelf 一律单行横向滚动、只摆第一分页；「显示全部」跳 /shelf/:kind 全览页。
 */
import { useEffect, useState, type JSX, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Headphones, ListMusic, LoaderCircle, Pause, Play, Radio, Search, SkipForward } from 'lucide-react';
import { RoomVolumeControl } from './RoomVolumeControl';
import { WebFollowControl } from './WebFollowControl';
import { ScarletHeroFrame } from './ScarletSkin';
import { ChartCard } from './ChartCard';
import { coverSrc } from './cover';
import { ArtistLinks } from './artist';
import type {
  HistoryEntry,
  HotTrack,
  RadioCatalogEntry,
  StatsEntry,
} from '../api/types';
import { api, roomStore } from '../app/session';
import { ActivityCard } from './ActivityCard';
import { formatClock } from './format';
import { useIdentity, useProviders, useRoomState } from './hooks';
import { isVisibleRadioSource } from './radioSources';
import { useToast } from './toast';
import { useShell } from './AppShell';

export default function HomeView(): JSX.Element {
  const { t } = useTranslation();
  const identity = useIdentity();
  const navigate = useNavigate();
  const state = useRoomState();
  const { canControl, setFullscreenOpen } = useShell();
  const { showError } = useToast();
  const [controlAction, setControlAction] = useState<'toggle' | 'skip' | null>(null);
  const controlBusy = controlAction !== null;
  const controlRoom = async (action: 'toggle' | 'skip') => {
    if (!canControl || !state.roomId || !state.playback.current || state.playback.preparing || controlBusy) return;
    setControlAction(action);
    try {
      await (action === 'skip' ? roomStore.skip() : state.playback.playing ? roomStore.pause() : roomStore.resume());
    } catch (error) {
      showError(error);
    } finally {
      setControlAction(null);
    }
  };
  const current = state.playback.current;

  return (
    <div className="home-page view-enter px-5 pt-[calc(var(--header-h)+0.75rem)] pb-10 md:px-8 md:pt-8">
      <header className="home-heading">
        <p className="text-sm text-muted">{t('lobby.greeting', { period: t(greetingKey()), name: identity?.name ?? '' })}</p>
        <h1 className="mt-1 text-[34px] font-bold tracking-tight text-paper">{t('home.listenTitle')}</h1>
      </header>
      {current && <section className="listening-hero" aria-label={t('home.listenTitle')}>
        <ScarletHeroFrame />
        <div className="hero-copy">
          <span className="hero-eyebrow"><span className="status-dot" />{t('np.title')}</span>
          <h2 className="hero-title">{current.title}</h2>
          <ArtistLinks artist={current.artist} contributors={current.contributors} trackRef={current.track_ref} className="text-muted" />
          <div className="hero-controls">
            <div className="room-playback-control" role="group" aria-labelledby="room-playback-label" aria-busy={controlBusy}>
              <div className="room-control-heading">
                <span id="room-playback-label">{t('home.roomPlaybackLabel')}</span>
                <span className="room-playback-status" aria-live="polite">
                  <span className="status-dot" aria-hidden="true" />
                  {t(state.playback.preparing ? 'home.roomPreparing' : state.playback.playing ? 'home.roomPlaying' : 'home.roomPaused')}
                </span>
              </div>
              <div className="room-control-actions">
                <div className="room-transport">
                  <button
                    type="button"
                    className="room-playback-button room-playback-primary"
                    disabled={!canControl || controlBusy || state.playback.preparing}
                    aria-label={t(state.playback.playing ? 'home.pauseRoom' : 'home.resumeRoom')}
                    title={!canControl ? t('home.roomControlRequired') : undefined}
                    onClick={() => void controlRoom('toggle')}
                  >
                    {controlAction === 'toggle' ? <LoaderCircle className="control-spinner h-4 w-4" aria-hidden="true" /> : state.playback.playing ? <Pause className="h-4 w-4 fill-current" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
                    {t(state.playback.playing ? 'room.pause' : 'room.resume')}
                  </button>
                  <button
                    type="button"
                    className="room-playback-button room-skip-button"
                    disabled={!canControl || controlBusy || state.playback.preparing}
                    aria-label={t('home.skipRoom')}
                    title={!canControl ? t('home.roomControlRequired') : t('home.skipRoom')}
                    onClick={() => void controlRoom('skip')}
                  >
                    {controlAction === 'skip' ? <LoaderCircle className="control-spinner h-4 w-4" aria-hidden="true" /> : <SkipForward className="h-4 w-4 fill-current" aria-hidden="true" />}
                    {t('home.nextTrack')}
                  </button>
                </div>
                <button type="button" className="hero-action" onClick={() => setFullscreenOpen(true)}>
                  <Headphones className="h-4 w-4" aria-hidden="true" />
                  {t('room.expand')}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="room-listening-options">
                {state.roomId && <RoomVolumeControl key={state.roomId} roomId={state.roomId} disabled={!canControl} />}
                <WebFollowControl />
              </div>
              {!canControl && <p className="room-control-hint">{t('home.roomControlRequired')}</p>}
            </div>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          {current?.cover_url ? <img src={coverSrc(current.cover_url)} alt="" /> : (
            <div className="record-art"><div className="record-label"><Headphones className="h-9 w-9" /></div></div>
          )}
        </div>

      </section>}

      <HotSection />
      <RecentSection />
      <RoomActivitySections />
      <ChartsSection />

      <nav className="home-shortcuts" aria-label={t('home.explore')}>
        {[
          { label: t('shell.navSearch'), description: t('home.searchDescription'), icon: Search, action: () => navigate('/search') },
          { label: t('home.chartsTitle'), description: t('home.chartsDescription'), icon: Radio, action: () => navigate('/charts') },
          { label: t('shell.library'), description: t('home.libraryDescription'), icon: ListMusic, action: () => navigate('/library') },
        ].map(({ label, description, icon: Icon, action }) => (
          <button key={label} type="button" className="shortcut-card" onClick={action}>
            <Icon className="shortcut-icon h-5 w-5" aria-hidden="true" />
            <span><strong>{label}</strong><small>{description}</small></span>
            <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
          </button>
        ))}
      </nav>

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
      <h2 className="text-[22px] font-bold tracking-tight text-paper">{title}</h2>
      {actionLabel && onAction && (
        <button
          type="button"
          disabled={actionDisabled}
          onClick={onAction}
          className="text-[13px] font-medium text-accent hover:underline disabled:opacity-40"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/** 封面 shelf 单行：定宽卡片横向滚动（横向吸附滚动），卡宽由卡片 className 控制。 */
function ShelfRow({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="music-shelf no-scrollbar -mx-2 flex snap-x gap-3 overflow-x-auto px-2 pb-3">{children}</div>
  );
}

// ---------- 榜单（可枚举有限电台源实例的内容化呈现） ----------

/** 首页精选上限：每个 provider 1 个代表条目（服务端顺序：静态在前、目录在后）；「显示全部」进 /charts。 */
const CHARTS_PER_PROVIDER = 1;

function ChartsSection(): JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const providers = useProviders();
  const { showError } = useToast();
  const [entries, setEntries] = useState<RadioCatalogEntry[] | null>(null);

  useEffect(() => {
    let dead = false;
    api
      .radioCatalogAll()
      .then((rows) => {
        if (!dead) setEntries(rows.filter((entry) => isVisibleRadioSource(entry.spec)));
      })
      .catch((error: unknown) => {
        if (dead) return;
        setEntries([]);
        showError(error);
      });
    return () => {
      dead = true;
    };
  }, [showError]);

  if (entries === null || entries.length === 0) return null;

  const byProvider = new Map<string, number>();
  const shown = entries.filter((entry) => {
    const count = byProvider.get(entry.provider) ?? 0;
    if (count >= CHARTS_PER_PROVIDER) return false;
    byProvider.set(entry.provider, count + 1);
    return true;
  });
  const hasMore = shown.length < entries.length;

  return (
    <section className="mt-10">
      <ShelfHeader
        title={t('home.chartsTitle')}
        actionLabel={hasMore ? t('home.showAll') : undefined}
        onAction={hasMore ? () => navigate('/charts') : undefined}
      />
      <ShelfRow>
        {shown.map((entry) => {
          const credentialOk =
            (providers?.find((p) => p.id === entry.provider)?.credential_status ?? 'none') ===
            'ok';
          return <ChartCard key={`${entry.provider}:${entry.spec}`} entry={entry} credentialOk={credentialOk} className="w-[180px] flex-none" />;
        })}
      </ShelfRow>
    </section>
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
