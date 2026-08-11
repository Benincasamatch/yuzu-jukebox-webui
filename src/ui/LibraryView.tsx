/**
 * 移动端曲库页：歌单列表（共享 LibraryList）。桌面端曲库在侧栏，
 * 此页是移动端 TabBar 的落地；导入/管理走桌面端（移动端不带管理功能），
 * 新建歌单与桌面同为 media_admin 门控（共享 CreatePlaylistDialog）。
 */
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { PlaylistInfo } from '../api/types';
import { api } from '../app/session';
import { CreatePlaylistDialog } from './CreatePlaylistDialog';
import { LibraryList } from './LibraryList';
import { useIdentity } from './hooks';

export default function LibraryView(): JSX.Element {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const identity = useIdentity();
  const canManageMedia = identity?.roles.includes('media_admin') ?? false;
  const [playlists, setPlaylists] = useState<PlaylistInfo[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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
    <div className="view-enter px-3 pt-4 pb-6">
      <div className="mb-3 flex items-center gap-2 px-1">
        <h1 className="min-w-0 flex-1 font-display text-xl font-semibold">
          {t('shell.library')}
        </h1>
        {canManageMedia && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label={t('lib.create')}
            title={t('lib.create')}
            className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-[var(--hover)] hover:text-paper"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <LibraryList playlists={playlists} />
      {canManageMedia && (
        <CreatePlaylistDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(playlist) => navigate(`/playlist/${encodeURIComponent(playlist.id)}`)}
        />
      )}
    </div>
  );
}
