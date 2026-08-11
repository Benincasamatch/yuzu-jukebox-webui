/**
 * 移动端曲库页：歌单列表（共享 LibraryList）。桌面端曲库在侧栏，
 * 此页是移动端 TabBar 的落地；新建/导入歌单与桌面同为 media_admin 门控
 * （共享 CreatePlaylistDialog / ImportPlaylistDialog），其余管理走桌面端。
 */
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { DropdownMenu } from 'radix-ui';
import { Download, ListPlus, Plus } from 'lucide-react';
import type { PlaylistInfo } from '../api/types';
import { api } from '../app/session';
import { CreatePlaylistDialog } from './CreatePlaylistDialog';
import { ImportPlaylistDialog } from './ImportPlaylistDialog';
import { LibraryList } from './LibraryList';
import { useIdentity } from './hooks';

const menuItemClass =
  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-muted outline-none data-[highlighted]:bg-[var(--hover)] data-[highlighted]:text-paper';

export default function LibraryView(): JSX.Element {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const identity = useIdentity();
  const canManageMedia = identity?.roles.includes('media_admin') ?? false;
  const [playlists, setPlaylists] = useState<PlaylistInfo[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // 挂载 + 路由变化时刷新：管理端导入/删除后回来即最新
  useEffect(() => {
    let dead = false;
    api
      .listPlaylists()
      .then((list) => {
        if (!dead) setPlaylists(list);
      })
      .catch(() => {
        if (!dead) setPlaylists([]);
      });
    return () => {
      dead = true;
    };
  }, [location.pathname]);

  return (
    <div className="view-enter px-3 pt-[calc(var(--header-h)+0.75rem)] pb-6">
      <div className="mb-3 flex items-center gap-2 px-1">
        <h1 className="min-w-0 flex-1 font-display text-xl font-semibold">
          {t('shell.library')}
        </h1>
        {canManageMedia && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label={t('lib.create')}
                title={t('lib.create')}
                className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-[var(--hover)] hover:text-paper"
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
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
      </div>
      <LibraryList playlists={playlists} />
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
    </div>
  );
}
