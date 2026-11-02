import { useEffect, useState } from 'react';
import { Download, Home, Library, ListPlus, Pin, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { DropdownMenu } from 'radix-ui';
import type { PlaylistInfo } from '../../api/types';
import { api } from '../../app/session';
import { ImportPlaylistDialog } from '../ImportPlaylistDialog';
import { CreatePlaylistDialog } from '../CreatePlaylistDialog';
import { PlaylistCover } from '../LibraryList';
import { useIdentity } from '../hooks';
import { useToast } from '../toast';

const menuItemClass =
  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-muted outline-none data-[highlighted]:bg-[var(--hover)] data-[highlighted]:text-paper';

/** 桌面导航与曲库栏：歌单数据随路由切换刷新；创建/导入入口按 media_admin 门控。 */
export function LibraryRail() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<PlaylistInfo[] | null>(null);
  const identity = useIdentity();
  const { showError } = useToast();
  const canManageMedia = identity?.roles.includes('media_admin') ?? false;
  const [createOpen, setCreateOpen] = useState(false);
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

  return (
    <aside className="library-sidebar flex h-full w-full flex-col">
      <nav className="sidebar-navigation" aria-label={t('shell.navigation')}>
        {[
          { to: '/', label: t('shell.navHome'), icon: Home },
          { to: '/search', label: t('shell.navSearch'), icon: Search },
          { to: '/library', label: t('shell.library'), icon: Library },
        ].map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <header className="flex flex-none items-center gap-3 px-4 py-3">
        <Library className="h-4 w-4 flex-none text-muted" aria-hidden="true" />
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
          <CreatePlaylistDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={(playlist) => navigate(`/playlist/${encodeURIComponent(playlist.id)}`)}
          />

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
