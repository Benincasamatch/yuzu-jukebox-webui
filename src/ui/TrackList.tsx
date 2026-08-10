/**
 * 入队共享件（SearchView 抽出的共享件）：useEnqueue 分块提交 + 选择式 TrackList。
 * 桌面交互（fine pointer）：单击 = 单选；再次单击已选中行 = 入队；Ctrl/⌘+点选多选；
 * 多选中单击任意行 = 收敛为单选；双击 = 直接入队；点列表空白/Esc = 取消选择；
 * Ctrl/⌘+A = 全选；右键 = 入队/加入歌单菜单。触屏（coarse pointer）没有
 * Ctrl/右键：保持点选 + 右下角 EnqueueFab 的旧模型。
 * 任何曲目列表（搜索/钻取/每日推荐/相似小窗）都应复用而非另造交互。
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type MouseEvent,
  type PointerEventHandler,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Clock3, ChevronLeft, GripVertical, ListMusic, ListPlus, Music2, X } from 'lucide-react';
import type { PlaylistInfo, SearchTrack } from '../api/types';
import { api, roomStore } from '../app/session';
import { coverSrc } from './cover';
import { formatDateTime, formatMs } from './format';
import { useIdentity, useMediaQuery, useRoomState } from './hooks';
import { useShell } from './shellContext';
import { useToast } from './toast';

export type TrackListTrack = SearchTrack & { added_at?: number; ord?: number };

export interface TrackMenuItem {
  label: string;
  danger?: boolean;
  onSelect: () => void;
}

/** 曲目封面：track.cover_url 为空 = 源站没给封面；回退代理路径让 GetTrack 再试一次。 */
function trackCover(track: SearchTrack): string {
  return coverSrc(track.cover_url || `/api/v1/cover/${encodeURIComponent(track.track_ref)}`);
}

function TrackCover({ track }: { track: SearchTrack }): JSX.Element {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="grid h-10 w-10 flex-none place-items-center rounded-md bg-panel-2 text-faint">
        <Music2 className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      src={trackCover(track)}
      alt=""
      onError={() => setFailed(true)}
      className="h-10 w-10 flex-none rounded-md object-cover"
    />
  );
}

/** 分块入队（100/批）+ toast + 未入房引导。toastTitle 仅单曲时展示。 */
export function useEnqueue(): (refs: string[], toastTitle?: string) => void {
  const { t } = useTranslation();
  const state = useRoomState();
  const { setRoomsOpen } = useShell();
  const { show, showError } = useToast();

  const enqueue = (refs: string[], toastTitle?: string) => {
    if (!state.roomId) {
      show(t('home.needRoom'));
      setRoomsOpen(true);
      return;
    }
    void (async () => {
      for (let offset = 0; offset < refs.length; offset += 100) {
        await roomStore.addQueue(refs.slice(offset, offset + 100));
      }
      show(
        refs.length === 1 && toastTitle
          ? t('room.addedToast', { title: toastTitle })
          : t('room.addedBatchToast', { count: refs.length }),
      );
    })().catch(showError);
  };

  return enqueue;
}

/** useTrackSelect 的返回契约：选择状态 + 行事件 + 菜单/FAB 节点。 */
export interface TrackSelect {
  selectedRefs: ReadonlySet<string>;
  /** 触屏点选语义需要旧式 toggle（如卡片复选框）时使用 */
  toggle: (trackRef: string) => void;
  /** Ctrl/⌘+A 全选：由持有曲目数组的一方调用 */
  selectAll: (refs: string[]) => void;
  clear: () => void;
  rowProps: (track: TrackListTrack) => {
    'aria-selected': boolean;
    onClick: (event: MouseEvent) => void;
    onDoubleClick: () => void;
    onContextMenu: (event: MouseEvent) => void;
  };
  menuNode: JSX.Element | null;
  fabNode: JSX.Element | null;
}

/**
 * 曲目选择 + 提交（TrackList 与 SearchView 的 all 视图共用）：
 * - 桌面：单击 = 单选；再次单击已选中行 = 入队；Ctrl/⌘+点击 = 切换多选；
 *   多选中单击 = 收敛为单选；双击 = 直接入队；右键 = 入队/加入歌单菜单
 *   （右键未选中的行 = 选中它再开菜单，即单曲右键也可直接入队）。
 * - 触屏：点按切换选中，EnqueueFab 提交（无 Ctrl/右键可用）。
 * rowProps 直接铺到行元素上；menuNode/fabNode 渲染在列表根部。
 */
export function useTrackSelect(
  extraItems?: (track: TrackListTrack) => TrackMenuItem[],
): TrackSelect {
  const { t } = useTranslation();
  const enqueue = useEnqueue();
  const coarse = useMediaQuery('(pointer: coarse)');
  const identity = useIdentity();
  const { show, showError } = useToast();
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<{ x: number; y: number; track: TrackListTrack } | null>(
    null,
  );
  // 右键菜单的歌单子面板：惰性拉取，仅列可编辑歌单（非绑定 + 本人创建或 media_admin）
  const [pickerOpen, setPickerOpen] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistInfo[] | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const toggle = (trackRef: string) => {
    setSelectedRefs((current) => {
      const next = new Set(current);
      if (next.has(trackRef)) next.delete(trackRef);
      else next.add(trackRef);
      return next;
    });
  };
  const clear = () => {
    setSelectedRefs(new Set());
    setMenu(null);
    setPickerOpen(false);
  };
  const selectAll = (refs: string[]) => {
    setSelectedRefs(new Set(refs));
  };

  const commit = () => {
    if (selectedRefs.size > 0) enqueue(Array.from(selectedRefs));
    clear();
  };

  const openPicker = () => {
    setPickerOpen(true);
    if (playlists === null) {
      api
        .listPlaylists()
        .then(setPlaylists)
        .catch(() => setPlaylists([]));
    }
  };

  const addToPlaylist = (playlist: PlaylistInfo) => {
    if (addingTo) return;
    const refs = Array.from(selectedRefs);
    if (refs.length === 0) return;
    setAddingTo(playlist.id);
    api
      .addPlaylistItems(playlist.id, refs)
      .then(() => {
        show(t('trackList.addedToPlaylist', { name: playlist.name, count: refs.length }));
        clear();
      })
      .catch(showError)
      .finally(() => setAddingTo(null));
  };

  const rowProps = (track: TrackListTrack) => ({
    'aria-selected': selectedRefs.has(track.track_ref),
    onClick: (event: MouseEvent) => {
      if (coarse || event.ctrlKey || event.metaKey) {
        toggle(track.track_ref);
        return;
      }
      // 单击 = 单选；再次单击已单选行 = 入队；多选中单击 = 收敛为单选
      const selected = selectedRefs.has(track.track_ref);
      if (selected && selectedRefs.size === 1) {
        clear();
        enqueue([track.track_ref], track.title);
        return;
      }
      setSelectedRefs(new Set([track.track_ref]));
    },
    onDoubleClick: () => {
      if (coarse) return;
      clear();
      enqueue([track.track_ref], track.title);
    },
    onContextMenu: (event: MouseEvent) => {
      event.preventDefault();
      setSelectedRefs((current) =>
        current.has(track.track_ref) ? current : new Set([track.track_ref]),
      );
      setPickerOpen(false);
      setMenu({ x: event.clientX, y: event.clientY, track });
    },
  });

  // 菜单外点击 / Esc 关闭（portal 到 body，捕获阶段判定归属）
  useEffect(() => {
    if (!menu) {
      setPickerOpen(false);
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest('[data-track-menu]')) setMenu(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [menu]);

  const additionalItems = menu ? (extraItems?.(menu.track) ?? []) : [];
  // 可编辑歌单：非绑定（绑定歌单 items 写会被服务端 409）且本人创建或 media_admin
  const isMediaAdmin = identity?.roles.includes('media_admin') ?? false;
  const editablePlaylists = (playlists ?? []).filter(
    (playlist) =>
      !playlist.bound_provider && (playlist.created_by === identity?.id || isMediaAdmin),
  );
  const menuItemClass =
    'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-muted outline-none hover:bg-[var(--hover)] hover:text-paper';
  const menuNode =
    menu &&
    createPortal(
      <div
        data-track-menu
        className="menu-content fixed z-50 w-48 rounded-lg border border-hairline bg-panel-2 p-1.5"
        style={{
          left: Math.max(8, Math.min(menu.x, window.innerWidth - 200)),
          top: Math.max(
            8,
            Math.min(menu.y, window.innerHeight - 150 - additionalItems.length * 38),
          ),
        }}
      >
        {pickerOpen ? (
          <>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className={menuItemClass}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {t('trackList.backToActions')}
            </button>
            <div className="mt-1 max-h-56 overflow-y-auto border-t border-hairline pt-1">
              {playlists === null && (
                <p className="px-2.5 py-2 text-[13px] text-faint">{t('common.loading')}</p>
              )}
              {playlists !== null && editablePlaylists.length === 0 && (
                <p className="px-2.5 py-2 text-[13px] text-faint">
                  {t('trackList.noEditablePlaylists')}
                </p>
              )}
              {editablePlaylists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  disabled={addingTo !== null}
                  onClick={() => addToPlaylist(playlist)}
                  className={`${menuItemClass} justify-between disabled:opacity-40`}
                >
                  <span className="truncate">{playlist.name}</span>
                  <span className="flex-none font-mono text-[11px] text-faint tabular-nums">
                    {playlist.track_count}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button type="button" onClick={commit} className={menuItemClass}>
              <ListPlus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('trackList.enqueueSelected', { count: selectedRefs.size })}
            </button>
            <button type="button" onClick={openPicker} className={menuItemClass}>
              <ListMusic className="h-3.5 w-3.5" aria-hidden="true" />
              {t('trackList.addToPlaylist')}
            </button>
            <button type="button" onClick={clear} className={menuItemClass}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {t('trackList.clearSelection')}
            </button>
            {additionalItems.length > 0 && (
              <div className="mt-1 border-t border-hairline pt-1">
                {additionalItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setMenu(null);
                      item.onSelect();
                    }}
                    className={`flex w-full cursor-pointer items-center rounded-md px-2.5 py-2 text-left text-[13px] outline-none hover:bg-[var(--hover)] ${
                      item.danger ? 'text-[#D05A4E]' : 'text-muted hover:text-paper'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>,
      document.body,
    );

  const fabNode = coarse ? (
    <EnqueueFab count={selectedRefs.size} onCommit={commit} />
  ) : null;

  return { selectedRefs, toggle, selectAll, clear, rowProps, menuNode, fabNode };
}

/** 选中数 >0 时出现的圆形入队按钮；portal 到 body（fixed 不被祖先 transform 劫持）。 */
export function EnqueueFab({
  count,
  onCommit,
}: {
  count: number;
  onCommit: () => void;
}): JSX.Element | null {
  const { t } = useTranslation();

  if (count === 0) return null;

  const label = `${t('batch.addSelected')} · ${t('batch.selectedCount', { count })}`;

  return createPortal(
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onCommit}
      className="fixed right-4 bottom-[calc(var(--chrome-b)+16px)] z-40 grid h-12 w-12 place-items-center rounded-full bg-accent text-on-accent transition-transform active:scale-95 md:right-7"
      style={{ boxShadow: 'var(--toast-shadow)' }}
    >
      <ListPlus className="h-5 w-5" aria-hidden="true" />
      <span className="absolute -top-1 -right-1 grid min-h-5 min-w-5 place-items-center rounded-full border border-hairline bg-panel-2 px-1 font-mono text-[10px] leading-none text-paper tabular-nums">
        {count}
      </span>
    </button>,
    document.body,
  );
}
type RowMeasure = {
  top: number;
  height: number;
};

type TrackDrag = {
  pointerId: number;
  index: number;
  tracksKey: string;
  startY: number;
  startScrollTop: number;
  listTop: number;
  dy: number;
  slot: number;
  rows: RowMeasure[];
  phase: 'dragging' | 'settling';
};

type DragHandleProps = {
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  onPointerMove: PointerEventHandler<HTMLButtonElement>;
  onPointerUp: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel: PointerEventHandler<HTMLButtonElement>;
};

const DRAG_TRANSITION_MS = 180;
const AUTO_SCROLL_EDGE_PX = 48;
const AUTO_SCROLL_MAX_PX = 14;

function dragAtClientY(drag: TrackDrag, clientY: number, scrollTop: number): TrackDrag {
  const dy = clientY - drag.startY + scrollTop - drag.startScrollTop;
  const dragged = drag.rows[drag.index];
  if (!dragged) return drag;

  const centerY = dragged.top + dragged.height / 2 + dy;
  let indexAfterRemoval = 0;
  for (let index = 0; index < drag.rows.length; index += 1) {
    if (index === drag.index) continue;
    const row = drag.rows[index];
    if (row && centerY > row.top + row.height / 2) indexAfterRemoval += 1;
  }

  const slot = indexAfterRemoval < drag.index ? indexAfterRemoval : indexAfterRemoval + 1;
  if (dy === drag.dy && slot === drag.slot) return drag;
  return { ...drag, dy, slot };
}

function settledDy(drag: TrackDrag): number {
  const dragged = drag.rows[drag.index];
  if (!dragged || drag.slot === drag.index || drag.slot === drag.index + 1) return 0;
  if (drag.slot < drag.index) return (drag.rows[drag.slot]?.top ?? dragged.top) - dragged.top;

  const previous = drag.rows[drag.slot - 1];
  if (!previous) return 0;
  return previous.top + previous.height - dragged.height - dragged.top;
}

function verticalScroller(element: HTMLElement): HTMLElement {
  let current = element.parentElement;
  while (current) {
    const overflowY = window.getComputedStyle(current).overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return document.documentElement;
}


/** 选择式曲目表格：双击直入队，Ctrl/⌘ 点选多首，右键菜单批量入队（触屏退化为点选+FAB）。 */
export function TrackList({
  tracks,
  onLoadMore,
  loadingMore = false,
  menuItems,
  onMoveItem,
  onRemoveItem,
}: {
  tracks: TrackListTrack[];
  onLoadMore?: () => void;
  loadingMore?: boolean;
  menuItems?: (track: TrackListTrack) => TrackMenuItem[];
  /** 提供即显示拖拽手柄并启用指针拖拽排序（编辑模式的 affordance 由调用方门控） */
  onMoveItem?: (fromIndex: number, toIndex: number) => void;
  /** 提供即每行尾显示 X 便携删除（编辑模式的 affordance 由调用方门控） */
  onRemoveItem?: (track: TrackListTrack) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const enqueue = useEnqueue();
  const select = useTrackSelect(menuItems);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dragRef = useRef<TrackDrag | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const captureRef = useRef<{ element: HTMLButtonElement; pointerId: number } | null>(null);
  const pointerYRef = useRef(0);
  const settleTimerRef = useRef<number | null>(null);
  const [drag, setDragState] = useState<TrackDrag | null>(null);
  const tracksKey = tracks
    .map((track, index) => `${track.ord ?? index}:${track.track_ref}`)
    .join('\u0000');
  const tracksKeyRef = useRef(tracksKey);
  tracksKeyRef.current = tracksKey;

  const setDrag = useCallback((next: TrackDrag | null) => {
    dragRef.current = next;
    setDragState(next);
  }, []);

  const releaseCapture = useCallback(() => {
    const capture = captureRef.current;
    captureRef.current = null;
    if (capture?.element.hasPointerCapture(capture.pointerId)) {
      capture.element.releasePointerCapture(capture.pointerId);
    }
  }, []);

  const clearDrag = useCallback(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    releaseCapture();
    scrollerRef.current = null;
    setDrag(null);
  }, [releaseCapture, setDrag]);

  const updateDrag = useCallback(
    (clientY: number) => {
      const current = dragRef.current;
      if (!current || current.phase !== 'dragging') return;
      const scrollTop = scrollerRef.current?.scrollTop ?? current.startScrollTop;
      setDrag(dragAtClientY(current, clientY, scrollTop));
    },
    [setDrag],
  );

  const finishDrag = useCallback(
    (pointerId: number, commit: boolean) => {
      const current = dragRef.current;
      if (!current || current.pointerId !== pointerId || current.phase !== 'dragging') return;
      releaseCapture();

      const listStillMatches = current.tracksKey === tracksKeyRef.current;
      const moved =
        listStillMatches && current.slot !== current.index && current.slot !== current.index + 1;
      if (commit && moved && onMoveItem) {
        const toIndex = current.slot < current.index ? current.slot : current.slot - 1;
        onMoveItem(current.index, toIndex);
      }

      setDrag({
        ...current,
        dy: commit && listStillMatches ? settledDy(current) : 0,
        phase: 'settling',
      });
      settleTimerRef.current = window.setTimeout(clearDrag, DRAG_TRANSITION_MS);
    },
    [clearDrag, onMoveItem, releaseCapture, setDrag],
  );

  useEffect(() => {
    const current = dragRef.current;
    if (current && (current.tracksKey !== tracksKey || !onMoveItem)) clearDrag();
  }, [clearDrag, onMoveItem, tracksKey]);

  const draggingPointerId = drag?.phase === 'dragging' ? drag.pointerId : null;
  useEffect(() => {
    if (draggingPointerId === null) return;
    let frame = 0;
    const tick = () => {
      const current = dragRef.current;
      const scroller = scrollerRef.current;
      if (!current || current.phase !== 'dragging' || !scroller) return;

      const y = pointerYRef.current;
      const rect = scroller.getBoundingClientRect();
      let speed = 0;
      if (y < rect.top + AUTO_SCROLL_EDGE_PX) {
        const proximity = Math.min(
          1,
          Math.max(0, (rect.top + AUTO_SCROLL_EDGE_PX - y) / AUTO_SCROLL_EDGE_PX),
        );
        speed = -AUTO_SCROLL_MAX_PX * proximity;
      } else if (y > rect.bottom - AUTO_SCROLL_EDGE_PX) {
        const proximity = Math.min(
          1,
          Math.max(0, (y - (rect.bottom - AUTO_SCROLL_EDGE_PX)) / AUTO_SCROLL_EDGE_PX),
        );
        speed = AUTO_SCROLL_MAX_PX * proximity;
      }

      if (speed !== 0) {
        const previousScrollTop = scroller.scrollTop;
        scroller.scrollTop += speed;
        if (scroller.scrollTop !== previousScrollTop) updateDrag(y);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [draggingPointerId, updateDrag]);

  useEffect(() => clearDrag, [clearDrag]);

  const dragHandleProps = (index: number): DragHandleProps => ({
    onPointerDown: (event) => {
      if (!onMoveItem || !event.isPrimary || event.button !== 0 || dragRef.current) return;
      const rows: RowMeasure[] = [];
      for (let rowIndex = 0; rowIndex < tracks.length; rowIndex += 1) {
        const rect = rowRefs.current[rowIndex]?.getBoundingClientRect();
        if (!rect) return;
        rows.push({ top: rect.top, height: rect.height });
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      captureRef.current = { element: event.currentTarget, pointerId: event.pointerId };
      pointerYRef.current = event.clientY;
      const list = listRef.current;
      if (!list) {
        releaseCapture();
        return;
      }
      const scroller = verticalScroller(list);
      scrollerRef.current = scroller;
      setDrag({
        pointerId: event.pointerId,
        index,
        tracksKey,
        startY: event.clientY,
        startScrollTop: scroller.scrollTop,
        listTop: list.getBoundingClientRect().top,
        dy: 0,
        slot: index + 1,
        rows,
        phase: 'dragging',
      });
    },
    onPointerMove: (event) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      event.preventDefault();
      pointerYRef.current = event.clientY;
      updateDrag(event.clientY);
    },
    onPointerUp: (event) => finishDrag(event.pointerId, true),
    onPointerCancel: (event) => finishDrag(event.pointerId, false),
  });

  const showAlbum = tracks.some((track) => track.album !== undefined);
  const showAddedAt = tracks.some((track) => track.added_at !== undefined);
  // 列按需拼装：拖拽手柄 / 序号 / 标题 / 专辑? / 添加日期? / 时长 / 删除?
  // 动态列走内联样式——Tailwind 构建期扫描，运行时拼的 grid-cols 类不会生成
  const gridTemplateColumns = [
    ...(onMoveItem ? ['24px'] : []),
    '28px',
    'minmax(220px,1fr)',
    ...(showAlbum ? ['minmax(140px,0.55fr)'] : []),
    ...(showAddedAt ? ['minmax(130px,0.5fr)'] : []),
    '64px',
    ...(onRemoveItem ? ['28px'] : []),
  ].join(' ');
  const columnCount =
    3 + (onMoveItem ? 1 : 0) + (showAlbum ? 1 : 0) + (showAddedAt ? 1 : 0) + (onRemoveItem ? 1 : 0);
  const tableWidthClass =
    columnCount >= 6 ? 'min-w-[760px]' : columnCount === 5 ? 'min-w-[620px]' : columnCount === 4 ? 'min-w-[440px]' : 'min-w-[400px]';

  // 新一批结果清空选择
  useEffect(() => {
    select.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks]);

  const dragMoved =
    drag?.phase === 'dragging' &&
    drag.slot !== drag.index &&
    drag.slot !== drag.index + 1;
  const lastRow = drag?.rows[drag.rows.length - 1];
  const indicatorTop =
    dragMoved && drag
      ? (drag.rows[drag.slot]?.top ?? ((lastRow?.top ?? drag.listTop) + (lastRow?.height ?? 0))) -
        drag.listTop
      : null;

  return (
    <div
      onKeyDown={(event) => {
        // Ctrl/⌘+A 全选（焦点在任意行上时冒泡到这里）；Esc 取消选择
        if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A')) {
          event.preventDefault();
          select.selectAll(tracks.map((track) => track.track_ref));
        } else if (event.key === 'Escape') {
          select.clear();
        }
      }}
    >
      {select.menuNode}
      {select.fabNode}
      <div className="overflow-x-auto">
        <div className={tableWidthClass}>
          <div
            style={{ gridTemplateColumns }}
            className="grid items-center gap-4 border-b border-hairline px-4 pb-2 text-[13px] text-muted"
          >
            {onMoveItem && <span aria-hidden="true" />}
            <span className="text-right">#</span>
            <span>{t('trackList.title')}</span>
            {showAlbum && <span>{t('trackList.album')}</span>}
            {showAddedAt && <span>{t('trackList.addedAt')}</span>}
            <span className="justify-self-end" title={t('trackList.duration')}>
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{t('trackList.duration')}</span>
            </span>
            {onRemoveItem && <span aria-hidden="true" />}
          </div>
          <div
            ref={listRef}
            className="relative py-1"
            onClick={(event) => {
              // 点列表空白（行间空隙/内边距）= 取消选择，不依赖右键菜单
              if (event.target === event.currentTarget) select.clear();
            }}
          >
            {indicatorTop !== null && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-4 z-20 h-0.5 bg-accent"
                style={{ top: indicatorTop }}
              />
            )}
            {tracks.map((track, index) => {
              const selected = select.selectedRefs.has(track.track_ref);
              const dragging = drag?.index === index;
              const rowProps = select.rowProps(track);
              let translateY = 0;
              if (drag) {
                if (dragging) {
                  translateY = drag.dy;
                } else if (drag.slot < drag.index && index >= drag.slot && index < drag.index) {
                  translateY = drag.rows[drag.index]?.height ?? 0;
                } else if (
                  drag.slot > drag.index + 1 &&
                  index > drag.index &&
                  index < drag.slot
                ) {
                  translateY = -(drag.rows[drag.index]?.height ?? 0);
                }
              }
              const rowStyle: CSSProperties | undefined = drag
                ? {
                    transform: `translate3d(0, ${translateY}px, 0)${
                      dragging && drag.phase === 'dragging' ? ' scale(1.015)' : ''
                    }`,
                    transition:
                      dragging && drag.phase === 'dragging'
                        ? 'none'
                        : `transform ${DRAG_TRANSITION_MS}ms ease`,
                    boxShadow: dragging
                      ? '0 5px 16px color-mix(in srgb, var(--paper) 10%, transparent)'
                      : undefined,
                  }
                : undefined;

              return (
                <div
                  key={`${track.ord ?? index}:${track.track_ref}`}
                  ref={(node) => {
                    rowRefs.current[index] = node;
                  }}
                  style={rowStyle}
                  className={dragging ? 'relative z-10 bg-panel' : undefined}
                >
                  <div
                    tabIndex={0}
                    aria-selected={rowProps['aria-selected']}
                    onClick={(event) => {
                      if (!dragRef.current) rowProps.onClick(event);
                    }}
                    onDoubleClick={() => {
                      if (!dragRef.current) rowProps.onDoubleClick();
                    }}
                    onContextMenu={(event) => {
                      if (!dragRef.current) rowProps.onContextMenu(event);
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget || dragRef.current) return;
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        if (event.ctrlKey || event.metaKey) select.toggle(track.track_ref);
                        else {
                          select.clear();
                          enqueue([track.track_ref], track.title);
                        }
                      }
                    }}
                    style={{ gridTemplateColumns }}
                    className={`grid cursor-pointer items-center gap-4 rounded-md px-4 py-2 select-none ${
                      dragging || selected ? 'bg-panel-2' : 'hover:bg-[var(--hover)]'
                    }`}
                  >
                    {onMoveItem && (
                      <button
                        type="button"
                        {...dragHandleProps(index)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={t('trackList.moveItem')}
                        title={t('trackList.moveItem')}
                        className="relative grid h-6 w-6 touch-none select-none place-items-center rounded-full text-faint after:absolute after:-inset-2 after:content-[''] hover:text-paper cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                    <span className="text-right text-[13px] text-muted tabular-nums">
                      {index + 1}
                    </span>
                    <span className="flex min-w-0 items-center gap-3">
                      <TrackCover track={track} />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] text-paper">{track.title}</span>
                        <span className="block truncate text-[13px] text-muted">{track.artist}</span>
                      </span>
                    </span>
                    {showAlbum && (
                      <span className="truncate text-[13px] text-muted">{track.album}</span>
                    )}
                    {showAddedAt && (
                      <span className="truncate text-[13px] text-muted tabular-nums">
                        {track.added_at === undefined ? '' : formatDateTime(track.added_at)}
                      </span>
                    )}
                    <span className="justify-self-end text-[13px] text-muted tabular-nums">
                      {formatMs(track.duration_ms)}
                    </span>
                    {onRemoveItem && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemoveItem(track);
                        }}
                        aria-label={t('trackList.removeItem')}
                        title={t('trackList.removeItem')}
                        className="grid h-6 w-6 place-items-center rounded-full text-faint transition hover:bg-[var(--hover)] hover:text-[#D05A4E]"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {onLoadMore && (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="w-full rounded-md py-2.5 text-xs font-semibold text-accent hover:bg-[var(--hover)] disabled:opacity-40"
            >
              {loadingMore ? t('common.loading') : t('searchPage.loadMore')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
