import { useEffect, useState } from 'react';
import { Download, Library, ListPlus, Pin, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { DropdownMenu } from 'radix-ui';
import type { PlaylistInfo } from '../../api/types';
import { api } from '../../app/session';
import { ImportPlaylistDialog } from '../ImportPlaylistDialog';
import { PlaylistCover } from '../LibraryList';
import { useIdentity } from '../hooks';
import { Dialog } from '../primitives';
import { useToast } from '../toast';

const inputClass =
  'mt-1.5 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-[13px] text-paper placeholder:text-faint focus:border-accent focus:outline-none';
const primaryButtonClass =
  'rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-on-accent hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40';
const secondaryButtonClass =
  'rounded-full border border-hairline px-4 py-1.5 text-[13px] text-muted hover:border-faint hover:text-paper disabled:cursor-not-allowed disabled:opacity-40';
const menuItemClass =
  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-muted outline-none data-[highlighted]:bg-[var(--hover)] data-[highlighted]:text-paper';

/** Spotify 风格桌面曲库栏：歌单数据随路由切换刷新；创建/导入入口按 media_admin 门控。 */
export function LibraryRail() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<PlaylistInfo[] | null>(null);
  const identity = useIdentity();
  const { show, showError } = useToast();
  const canManageMedia = identity?.roles.includes('media_admin') ?? false;
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .listPlaylists()
      .then((list) => {
        if (!cancelled) setPlaylists(list);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPlaylists([]);
          showError(error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname, showError]);

  const createPlaylist = async () => {
    const name = createName.trim();
    if (!name || createBusy) return;
    setCreateBusy(true);
    try {
      const playlist = await api.createPlaylist({
        name,
        description: createDescription.trim() || undefined,
      });
      setCreateOpen(false);
      setCreateName('');
      setCreateDescription('');
      show(t('lib.created'));
      navigate(`/playlist/${encodeURIComponent(playlist.id)}`);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <aside className="flex h-full w-full flex-col rounded-lg bg-panel">
      <header className="flex flex-none items-center gap-3 px-4 py-3">
        <Library className="h-6 w-6 flex-none text-muted" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-paper">
          {t('lib.title')}
        </h2>
        {canManageMedia && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="flex flex-none items-center gap-1 rounded-full bg-panel-2 py-1.5 pr-3 pl-2.5 text-[13px] font-semibold text-muted transition-colors hover:text-paper"
                title={t('lib.create')}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('lib.createShort')}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="menu-content z-50 w-48 rounded-lg border border-hairline bg-panel-2 p-1.5"
              >
                <DropdownMenu.Item className={menuItemClass} onSelect={() => setCreateOpen(true)}>
                  <ListPlus className="h-4 w-4" aria-hidden="true" />
                  {t('lib.newPlaylist')}
                </DropdownMenu.Item>
                <DropdownMenu.Item className={menuItemClass} onSelect={() => setImportOpen(true)}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {t('lib.importPlaylist')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {playlists === null ? (
          <div className="px-2 py-1 text-[12px] text-faint">{t('shell.libraryLoading')}</div>
        ) : playlists.length === 0 ? (
          <div className="px-2 py-1 text-[12px] text-muted">{t('shell.libraryEmpty')}</div>
        ) : (
          <nav className="flex flex-col gap-0.5" aria-label={t('lib.title')}>
            {playlists.map((playlist) => (
              <NavLink
                key={playlist.id}
                to={`/playlist/${playlist.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors ${
                    isActive ? 'bg-panel-2' : 'hover:bg-[var(--hover)]'
                  }`
                }
              >
                <PlaylistCover playlist={playlist} className="h-12 w-12" />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1 text-[14px] text-paper">
                    <span className="truncate">{playlist.name}</span>
                    {playlist.pinned && (
                      <Pin
                        className="h-3 w-3 flex-none text-faint"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span className="block truncate text-[12px] text-muted">
                    {playlist.bound_provider
                      ? t('shell.libraryBound', { provider: playlist.bound_provider })
                      : t('shell.libraryTracks', { count: playlist.track_count })}
                  </span>
                </span>
              </NavLink>
            ))}
          </nav>
        )}
      </div>

      {canManageMedia && (
        <>
          <Dialog open={createOpen} onOpenChange={setCreateOpen} title={t('lib.createDialogTitle')}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void createPlaylist();
              }}
            >
              <label className="block text-xs text-muted" htmlFor="library-playlist-name">
                {t('lib.nameLabel')}
              </label>
              <input
                id="library-playlist-name"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder={t('lib.namePlaceholder')}
                className={inputClass}
                required
              />
              <label
                className="mt-4 block text-xs text-muted"
                htmlFor="library-playlist-description"
              >
                {t('lib.descriptionLabel')}
              </label>
              <textarea
                id="library-playlist-description"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                placeholder={t('lib.descriptionPlaceholder')}
                rows={3}
                className={`${inputClass} resize-y`}
              />
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={createBusy}
                  className={secondaryButtonClass}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createBusy || !createName.trim()}
                  className={primaryButtonClass}
                >
                  {createBusy ? t('lib.creating') : t('lib.createAction')}
                </button>
              </div>
            </form>
          </Dialog>

          <ImportPlaylistDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            onImported={(playlist) => navigate(`/playlist/${encodeURIComponent(playlist.id)}`)}
          />
        </>
      )}
    </aside>
  );
}
