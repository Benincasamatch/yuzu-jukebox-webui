/**
 * Shelf 全览页（/shelf/:kind）：首页封面 shelf 的「显示全部」去向。
 * kind = hot（全局热门，分页）| recent（最近播放，分页）| room（本房热门，一次取 50）。
 * 卡片网格多行陈列；分页加载在本页进行（首页单行只摆第一分页）。
 */
import { useCallback, useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';
import type { HistoryEntry, HotTrack, StatsEntry } from '../api/types';
import { api } from '../app/session';
import { ActivityCard } from './ActivityCard';
import { formatClock } from './format';
import { useRoomState } from './hooks';
import { useToast } from './toast';

const PAGE_SIZE = 24;

type ShelfItem = { key: string; trackRef: string; title: string; meta: string };

export default function ShelfView(): JSX.Element {
  const { kind } = useParams<{ kind: string }>();
  if (kind === 'hot') return <HotShelf />;
  if (kind === 'recent') return <RecentShelf />;
  if (kind === 'room') return <RoomShelf />;
  return <Navigate to="/" replace />;
}

function ShelfScaffold({
  title,
  items,
  loading,
  hasMore,
  onLoadMore,
}: {
  title: string;
  items: ShelfItem[] | null;
  loading: boolean;
  hasMore: boolean;
  onLoadMore?: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="view-enter px-4 pt-[calc(var(--header-h)+0.75rem)] pb-10 md:px-8 md:pt-6">
      <h1 className="text-2xl font-bold text-paper">{title}</h1>
      {items === null ? (
        <p className="mt-6 text-sm text-muted">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{t('shelf.empty')}</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {items.map((item) => (
              <ActivityCard
                key={item.key}
                trackRef={item.trackRef}
                title={item.title}
                meta={item.meta}
              />
            ))}
          </div>
          {hasMore && onLoadMore && (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loading}
              className="mt-6 w-full rounded-full border border-hairline py-2.5 text-[13px] font-semibold text-muted transition-colors hover:border-muted hover:text-paper disabled:opacity-40"
            >
              {loading ? t('common.loading') : t('home.loadMore')}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** 分页 shelf 的通用装配：fetcher(offset) 返回一页，满页视为还有下一页。 */
function usePagedShelf(fetcher: (offset: number) => Promise<ShelfItem[]>) {
  const { showError } = useToast();
  const [items, setItems] = useState<ShelfItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let dead = false;
    fetcher(0)
      .then((rows) => {
        if (!dead) setItems(rows);
      })
      .catch(() => {
        if (!dead) setItems([]);
      });
    return () => {
      dead = true;
    };
  }, [fetcher]);

  const loadMore = useCallback(() => {
    if (loading || !items) return;
    setLoading(true);
    fetcher(items.length)
      .then((more) => setItems((current) => [...(current ?? []), ...more]))
      .catch(showError)
      .finally(() => setLoading(false));
  }, [fetcher, items, loading, showError]);

  return { items, loading, loadMore };
}

function HotShelf(): JSX.Element {
  const { t } = useTranslation();
  const fetcher = useCallback(
    (offset: number) =>
      api.hotTracks(7, PAGE_SIZE, offset).then((rows: HotTrack[]) =>
        rows.map((entry) => ({
          key: entry.track_ref,
          trackRef: entry.track_ref,
          title: entry.title,
          meta: entry.artist
            ? `${entry.artist} · ${t('home.playCount', { count: entry.play_count })}`
            : t('home.playCount', { count: entry.play_count }),
        })),
      ),
    [t],
  );
  const { items, loading, loadMore } = usePagedShelf(fetcher);
  return (
    <ShelfScaffold
      title={t('home.hotTitle')}
      items={items}
      loading={loading}
      hasMore={items !== null && items.length % PAGE_SIZE === 0}
      onLoadMore={loadMore}
    />
  );
}

function RecentShelf(): JSX.Element {
  const { t } = useTranslation();
  const fetcher = useCallback(
    (offset: number) =>
      api.myHistory(offset, PAGE_SIZE).then((rows: HistoryEntry[]) =>
        rows.map((entry) => ({
          key: `${entry.track_ref}:${entry.ended_at}`,
          trackRef: entry.track_ref,
          title: entry.title,
          meta: entry.artist
            ? `${entry.artist} · ${t('home.playedAt', { time: formatClock(entry.ended_at) })}`
            : t('home.playedAt', { time: formatClock(entry.ended_at) }),
        })),
      ),
    [t],
  );
  const { items, loading, loadMore } = usePagedShelf(fetcher);
  return (
    <ShelfScaffold
      title={t('home.recentTitle')}
      items={items}
      loading={loading}
      hasMore={items !== null && items.length % PAGE_SIZE === 0}
      onLoadMore={loadMore}
    />
  );
}

function RoomShelf(): JSX.Element {
  const { t } = useTranslation();
  const state = useRoomState();
  const [items, setItems] = useState<ShelfItem[] | null>(null);
  const roomId = state.roomId;

  useEffect(() => {
    setItems(null);
    if (!roomId) return;
    let dead = false;
    api
      .roomStats(roomId, 50)
      .then((rows: StatsEntry[]) => {
        if (dead) return;
        setItems(
          rows.map((entry) => ({
            key: entry.track_ref,
            trackRef: entry.track_ref,
            title: entry.title,
            meta: entry.artist
              ? `${entry.artist} · ${t('home.playCount', { count: entry.play_count })}`
              : t('home.playCount', { count: entry.play_count }),
          })),
        );
      })
      .catch(() => !dead && setItems([]));
    return () => {
      dead = true;
    };
  }, [roomId, t]);

  return (
    <ShelfScaffold title={t('home.statsTitle')} items={items} loading={false} hasMore={false} />
  );
}
