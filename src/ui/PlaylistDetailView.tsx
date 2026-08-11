/**
 * 歌单详情页：浏览歌单条目、单首点歌、整单入队。
 * 入队目标恒为当前房间——未入房时按钮引导先选房间。
 */
import { useEffect, useRef, useState, type JSX, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { DropdownMenu } from 'radix-ui';
import {
  ImageOff,
  MoreHorizontal,
  Pencil,
  Play,
  RefreshCw,
  Shuffle,
  Trash2,
  Unlink,
  Upload,
} from 'lucide-react';
import type { PlaylistDetail, UpdatePlaylistMetaInput } from '../api/types';
import { api, roomStore } from '../app/session';
import { coverSrc } from './cover';
import { formatDateTime } from './format';
import { extractGlowColors } from './glow';
import { useIdentity, useRoomState } from './hooks';
import { PlaylistCover } from './LibraryList';
import { ConfirmDialog, Dialog } from './primitives';
import { RadioPlayButton } from './RadioPlayButton';
import { TrackList, type TrackMenuItem, type TrackListTrack } from './TrackList';
import { useShell } from './AppShell';
import { useToast } from './toast';

const PAGE_SIZE = 50;
const QUEUE_CHUNK_SIZE = 100;
function shuffleRefs(refs: string[]): void {
  for (let index = refs.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = refs[index]!;
    refs[index] = refs[randomIndex]!;
    refs[randomIndex] = current;
  }
}

export default function PlaylistDetailView(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { playlistId = '' } = useParams();
  const identity = useIdentity();
  const state = useRoomState();
  const { nameOf, setRoomsOpen } = useShell();
  const { show, showError } = useToast();

  const [detail, setDetail] = useState<PlaylistDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [managementBusy, setManagementBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [metaEditOpen, setMetaEditOpen] = useState(false);
  const [metaName, setMetaName] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaPinned, setMetaPinned] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [headerColor, setHeaderColor] = useState('var(--panel-2)');
  const [coverFailed, setCoverFailed] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const canManage = identity?.roles.includes('media_admin') ?? false;
  const canEditMeta = Boolean(
    identity &&
      detail &&
      (detail.playlist.created_by === identity.id || identity.roles.includes('media_admin')),
  );

  useEffect(() => {
    setDetail(null);
    setFailed(false);
    setDeleteOpen(false);
    setEditMode(false);
    setMetaEditOpen(false);
    setHeaderColor('var(--panel-2)');
    setCoverFailed(false);
    let dead = false;
    api
      .getPlaylist(playlistId, 0, PAGE_SIZE)
      .then((res) => {
        if (!dead) setDetail(res);
      })
      .catch((err: unknown) => {
        if (!dead) {
          setFailed(true);
          showError(err);
        }
      });
    return () => {
      dead = true;
    };
  }, [playlistId, showError]);

  const refreshDetail = async () => {
    const refreshed = await api.getPlaylist(playlistId, 0, PAGE_SIZE);
    setDetail(refreshed);
    setFailed(false);
    setHeaderColor('var(--panel-2)');
    setCoverFailed(false);
  };

  const openMetaEditor = () => {
    if (!detail || !canEditMeta) return;
    setMetaName(detail.playlist.name);
    setMetaDescription(detail.playlist.description);
    setMetaPinned(Boolean(detail.playlist.pinned));
    setMetaEditOpen(true);
  };

  const saveMetadata = async () => {
    if (!detail || !canEditMeta || metaSaving) return;

    const name = metaName.trim();
    const description = metaDescription.trim();
    const changes: UpdatePlaylistMetaInput = {};
    if (!detail.playlist.bound_provider && name !== detail.playlist.name) changes.name = name;
    if (description !== detail.playlist.description) changes.description = description;
    if (metaPinned !== Boolean(detail.playlist.pinned)) changes.pinned = metaPinned;
    if (Object.keys(changes).length === 0) return;

    setMetaSaving(true);
    try {
      const playlist = await api.updatePlaylistMeta(detail.playlist.id, changes);
      setDetail((current) =>
        current && current.playlist.id === playlist.id ? { ...current, playlist } : current,
      );
      setMetaEditOpen(false);
      show(t('playlist.metaUpdated'));
    } catch (error: unknown) {
      showError(error);
    } finally {
      setMetaSaving(false);
    }
  };

  /** 追加下一页（分页契约：GET /playlists/{id}?offset=&limit=，默认 50/上限 200）。 */
  const loadMore = () => {
    if (!detail || loadingMore || detail.items.length >= detail.playlist.track_count) return;
    setLoadingMore(true);
    api
      .getPlaylist(playlistId, detail.items.length, PAGE_SIZE)
      .then((page) => {
        setDetail((current) => {
          if (!current || current.playlist.id !== playlistId) return current;
          return { ...page, offset: 0, items: [...current.items, ...page.items] };
        });
      })
      .catch(showError)
      .finally(() => setLoadingMore(false));
  };

  const requireRoom = (): boolean => {
    if (state.roomId) return true;
    show(t('home.needRoom'));
    setRoomsOpen(true);
    return false;
  };

  const addPlaylist = (shuffle: boolean) => {
    if (!requireRoom() || busy) return;
    setBusy(true);
    void (async () => {
      // 拉齐全部分页再按 100 条/批原子入队（与服务端批量上限对齐）
      const refs: string[] = [];
      let offset = 0;
      for (;;) {
        const page = await api.getPlaylist(playlistId, offset, PAGE_SIZE);
        refs.push(...page.items.map((item) => item.track_ref));
        if (page.items.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      if (shuffle) shuffleRefs(refs);
      for (let index = 0; index < refs.length; index += QUEUE_CHUNK_SIZE) {
        await roomStore.addQueue(refs.slice(index, index + QUEUE_CHUNK_SIZE));
      }
      show(t('room.addedBatchToast', { count: refs.length }));
    })()
      .catch(showError)
      .finally(() => setBusy(false));
  };

  const applyCover = async (file: File) => {
    if (!detail || !canManage || detail.playlist.bound_provider || managementBusy) return;
    if (file.size > 8 * 1024 * 1024) {
      show(t('playlist.coverTooLarge'));
      return;
    }
    setManagementBusy(true);
    try {
      await api.setPlaylistCover(detail.playlist.id, file);
      show(t('playlist.coverSet'));
      await refreshDetail();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setManagementBusy(false);
    }
  };

  const clearCover = async () => {
    if (!detail || !canManage || detail.playlist.bound_provider || managementBusy) return;
    setManagementBusy(true);
    try {
      await api.clearPlaylistCover(detail.playlist.id);
      show(t('playlist.coverCleared'));
      await refreshDetail();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setManagementBusy(false);
    }
  };

  const syncBound = async () => {
    if (!detail?.playlist.bound_provider || !canManage || managementBusy) return;
    setManagementBusy(true);
    try {
      await api.syncPlaylist(detail.playlist.id);
      show(t('playlist.synced'));
      await refreshDetail();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setManagementBusy(false);
    }
  };

  const detachBound = async () => {
    if (!detail?.playlist.bound_provider || !canManage || managementBusy) return;
    setManagementBusy(true);
    try {
      await api.detachPlaylist(detail.playlist.id);
      show(t('playlist.detached'));
      await refreshDetail();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setManagementBusy(false);
    }
  };

  const deleteCurrentPlaylist = async () => {
    if (!detail || !canManage || managementBusy) return;
    setDeleteOpen(false);
    setManagementBusy(true);
    try {
      await api.deletePlaylist(detail.playlist.id);
      show(t('playlist.deleted'));
      navigate('/');
    } catch (error: unknown) {
      showError(error);
      setManagementBusy(false);
    }
  };

  const removeItem = async (ord: number) => {
    if (!detail || !canManage || detail.playlist.bound_provider || managementBusy) return;
    setManagementBusy(true);
    try {
      await api.deletePlaylistItem(detail.playlist.id, ord);
      show(t('playlist.itemDeleted'));
      await refreshDetail();
    } catch (error: unknown) {
      showError(error);
    } finally {
      setManagementBusy(false);
    }
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (
      !detail ||
      !canManage ||
      detail.playlist.bound_provider ||
      managementBusy ||
      fromIndex === toIndex
    ) {
      return;
    }
    const fromOrd = detail.items[fromIndex]?.ord;
    const toOrd = detail.items[toIndex]?.ord;
    if (fromOrd === undefined || toOrd === undefined) return;
    const currentPlaylistId = detail.playlist.id;
    setManagementBusy(true);
    void api
      .movePlaylistItem(currentPlaylistId, fromOrd, toOrd)
      .then(async () => {
        show(t('playlist.itemMoved'));
        await refreshDetail();
      })
      .catch(showError)
      .finally(() => setManagementBusy(false));
  };

  const handleCoverLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    setHeaderColor(extractGlowColors(event.currentTarget)?.[0] ?? 'var(--panel-2)');
  };

  if (failed) {
    return (
      <div className="view-enter px-4 pt-4 pb-10 md:px-8 md:pt-6">
        <p className="text-muted">{t('error.internal')}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="view-enter px-4 pt-4 pb-10 md:px-8 md:pt-6">
        <p className="text-muted">{t('batch.playlistLoading')}</p>
      </div>
    );
  }

  const bound = Boolean(detail.playlist.bound_provider);
  const canEditItems = canManage && !bound;
  const normalizedMetaName = metaName.trim();
  const normalizedMetaDescription = metaDescription.trim();
  const metadataChanged =
    (!bound && normalizedMetaName !== detail.playlist.name) ||
    normalizedMetaDescription !== detail.playlist.description ||
    metaPinned !== Boolean(detail.playlist.pinned);
  const playLabel = busy ? t('batch.adding') : t('playlist.addAll');
  const tracks: TrackListTrack[] = detail.items.map((item) => ({
    track_ref: item.track_ref,
    title: item.title,
    artist: item.artist,
    duration_ms: item.duration_ms,
    contributors: item.contributors,
    added_at: item.added_at,
    ord: item.ord,
  }));
  const trackMenuItems: ((track: TrackListTrack) => TrackMenuItem[]) | undefined = canEditItems
    ? (track) =>
        track.ord === undefined
          ? []
          : [
              {
                label: t('playlist.removeItem'),
                danger: true,
                onSelect: () => void removeItem(track.ord!),
              },
            ]
    : undefined;

  const menuItemClass =
    'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-muted outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-[var(--hover)] data-[highlighted]:text-paper';

  return (
    <div className="view-enter pb-10">
      <section
        className="px-4 pt-8 pb-7 md:px-7 md:pt-12 md:pb-8"
        style={{
          background: `linear-gradient(to bottom, color-mix(in srgb, ${headerColor} 55%, transparent), transparent)`,
        }}
      >
        <div className="flex min-w-0 items-end gap-6 overflow-hidden">
          {detail.playlist.cover_url && !coverFailed ? (
            <img
              src={coverSrc(detail.playlist.cover_url)}
              alt={t('playlist.coverAlt', { name: detail.playlist.name })}
              onLoad={handleCoverLoad}
              onError={() => {
                setCoverFailed(true);
                setHeaderColor('var(--panel-2)');
              }}
              className="h-40 w-40 flex-none rounded-md object-cover shadow-2xl md:h-[232px] md:w-[232px]"
            />
          ) : (
            <PlaylistCover
              playlist={{ ...detail.playlist, cover_url: '' }}
              className="h-40 w-40 shadow-2xl [&_svg]:h-10 [&_svg]:w-10 md:h-[232px] md:w-[232px]"
            />
          )}
          <div className="min-w-0 pb-1">
            <p className="mb-2 text-xs font-semibold text-paper">{t('playlist.label')}</p>
            <h1 className="line-clamp-2 text-4xl leading-[0.98] font-bold tracking-[-0.04em] text-paper md:text-6xl">
              {detail.playlist.name}
            </h1>
            <div className="mt-5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted">
              {detail.playlist.description && (
                <span className="min-w-0 truncate">{detail.playlist.description}</span>
              )}
              <span className="flex-none font-semibold text-paper">
                {t('playlist.createdBy', {
                  name: nameOf(detail.playlist.created_by),
                })}
              </span>
              <span className="flex-none">
                {t('playlist.trackCount', { count: detail.playlist.track_count })}
              </span>
              {/* 绑定歌单：创建于/跟随徽标是噪音，只保留同步状态 */}
              {!bound && (
                <span className="flex-none">
                  {t('playlist.createdAt', {
                    time: formatDateTime(detail.playlist.created_at),
                  })}
                </span>
              )}
              {bound &&
                detail.playlist.last_sync_at !== undefined &&
                detail.playlist.last_sync_at > 0 && (
                  <span className="flex-none text-faint">
                    {t('playlist.lastSync', {
                      time: formatDateTime(detail.playlist.last_sync_at),
                    })}
                  </span>
                )}
              {bound && detail.playlist.last_sync_error && (
                <span className="min-w-0 truncate text-[#D05A4E]">
                  {t('playlist.lastSyncError', { error: detail.playlist.last_sync_error })}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 px-4 py-6 md:px-7">
        <button
          type="button"
          disabled={busy || detail.items.length === 0}
          onClick={() => addPlaylist(false)}
          aria-label={playLabel}
          title={playLabel}
          className="grid h-14 w-14 flex-none place-items-center rounded-full bg-accent text-on-accent shadow-lg transition-transform hover:scale-105 active:scale-100 disabled:opacity-40"
        >
          <Play className="h-6 w-6 translate-x-px fill-current" aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={busy || detail.items.length === 0}
          onClick={() => addPlaylist(true)}
          aria-label={t('playlist.shuffleAll')}
          title={t('playlist.shuffleAll')}
          className="grid h-12 w-12 flex-none place-items-center rounded-full text-muted transition hover:bg-[var(--hover)] hover:text-paper active:scale-95 disabled:opacity-40"
        >
          <Shuffle className="h-6 w-6" aria-hidden="true" />
        </button>
        <RadioPlayButton source={`playlist:${detail.playlist.id}`} />
        {canEditItems && (
          <button
            type="button"
            onClick={() => setEditMode((current) => !current)}
            aria-label={editMode ? t('playlist.finishEdit') : t('playlist.editItems')}
            title={editMode ? t('playlist.finishEdit') : t('playlist.editItems')}
            aria-pressed={editMode}
            className={`grid h-12 w-12 flex-none place-items-center rounded-full transition active:scale-95 ${
              editMode
                ? 'bg-accent text-on-accent'
                : 'text-muted hover:bg-[var(--hover)] hover:text-paper'
            }`}
          >
            <Pencil className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        {canEditMeta && (
          <button
            type="button"
            disabled={managementBusy || metaSaving}
            onClick={openMetaEditor}
            aria-label={t('playlist.editMeta')}
            title={t('playlist.editMeta')}
            className="ml-auto grid h-10 w-10 flex-none place-items-center rounded-full text-muted transition hover:bg-[var(--hover)] hover:text-paper active:scale-95 disabled:opacity-40"
          >
            <Pencil className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        {canManage && (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void applyCover(file);
              }}
            />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  disabled={managementBusy}
                  aria-label={t('playlist.manage')}
                  title={t('playlist.manage')}
                  className="grid h-10 w-10 flex-none place-items-center rounded-full text-muted transition hover:bg-[var(--hover)] hover:text-paper disabled:opacity-40"
                >
                  <MoreHorizontal className="h-6 w-6" aria-hidden="true" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="menu-content z-50 min-w-48 rounded-lg border border-hairline bg-panel-2 p-1.5"
                >
                  {!bound && (
                    <DropdownMenu.Item
                      disabled={managementBusy}
                      onSelect={() => coverInputRef.current?.click()}
                      className={menuItemClass}
                    >
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      {t('playlist.setCover')}
                    </DropdownMenu.Item>
                  )}
                  {!bound && detail.playlist.cover_url && (
                    <DropdownMenu.Item
                      disabled={managementBusy}
                      onSelect={() => void clearCover()}
                      className={menuItemClass}
                    >
                      <ImageOff className="h-4 w-4" aria-hidden="true" />
                      {t('playlist.clearCover')}
                    </DropdownMenu.Item>
                  )}
                  {bound && (
                    <>
                      <DropdownMenu.Item
                        disabled={managementBusy}
                        onSelect={() => void syncBound()}
                        className={menuItemClass}
                      >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        {t('playlist.syncNow')}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        disabled={managementBusy}
                        onSelect={() => void detachBound()}
                        className={menuItemClass}
                      >
                        <Unlink className="h-4 w-4" aria-hidden="true" />
                        {t('playlist.detach')}
                      </DropdownMenu.Item>
                    </>
                  )}
                  <DropdownMenu.Separator className="my-1 h-px bg-hairline" />
                  <DropdownMenu.Item
                    disabled={managementBusy}
                    onSelect={() => setDeleteOpen(true)}
                    className={`${menuItemClass} text-[#D05A4E] data-[highlighted]:text-[#D05A4E]`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {t('playlist.delete')}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </>
        )}
      </div>

      <div className="px-4 md:px-7">
        {detail.items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{t('batch.playlistEmpty')}</p>
        ) : (
          <TrackList
            tracks={tracks}
            menuItems={trackMenuItems}
            onMoveItem={canEditItems && editMode ? moveItem : undefined}
            onRemoveItem={
              canEditItems && editMode
                ? (track) => {
                    if (track.ord !== undefined) void removeItem(track.ord);
                  }
                : undefined
            }
            onLoadMore={detail.items.length < detail.playlist.track_count ? loadMore : undefined}
            loadingMore={loadingMore}
          />
        )}
      </div>

      {canEditMeta && (
        <Dialog
          open={metaEditOpen}
          onOpenChange={(open) => {
            if (!open && !metaSaving) setMetaEditOpen(false);
          }}
          title={t('playlist.editMetaTitle')}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveMetadata();
            }}
          >
            <label className="block text-xs text-muted" htmlFor="playlist-meta-name">
              {t('playlist.nameLabel')}
            </label>
            <input
              id="playlist-meta-name"
              value={metaName}
              onChange={(event) => setMetaName(event.target.value)}
              disabled={bound || metaSaving}
              required
              className="mt-1.5 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-[13px] text-paper placeholder:text-faint focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            {bound && (
              <p className="mt-1.5 text-xs leading-5 text-faint">
                {t('playlist.boundNameHint', { provider: detail.playlist.bound_provider })}
              </p>
            )}
            <label
              className="mt-4 block text-xs text-muted"
              htmlFor="playlist-meta-description"
            >
              {t('playlist.descriptionLabel')}
            </label>
            <input
              id="playlist-meta-description"
              value={metaDescription}
              onChange={(event) => setMetaDescription(event.target.value)}
              disabled={metaSaving}
              className="mt-1.5 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-[13px] text-paper placeholder:text-faint focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            <label className="mt-4 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={metaPinned}
                onChange={(event) => setMetaPinned(event.target.checked)}
                disabled={metaSaving}
                className="yuzu-checkbox"
              />
              {t('playlist.pinnedLabel')}
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMetaEditOpen(false)}
                disabled={metaSaving}
                className="rounded-full border border-hairline px-4 py-1.5 text-[13px] text-muted hover:border-faint hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={
                  metaSaving || !metadataChanged || (!bound && normalizedMetaName.length === 0)
                }
                className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-on-accent hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {metaSaving ? t('playlist.savingMeta') : t('playlist.saveMeta')}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {canManage && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={t('playlist.deleteDialogTitle')}
          description={t('playlist.deleteDialogDescription', { name: detail.playlist.name })}
          confirmText={t('playlist.delete')}
          cancelText={t('common.cancel')}
          danger
          onConfirm={() => void deleteCurrentPlaylist()}
        />
      )}
    </div>
  );
}
