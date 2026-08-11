/**
 * 新建歌单对话框（桌面曲库栏 LibraryRail 与移动端曲库页 LibraryView 共用）：
 * 名称 + 描述表单，成功后经 onCreated 回调（调用方决定跳转/刷新）。
 */
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlaylistInfo } from '../api/types';
import { api } from '../app/session';
import { Dialog } from './primitives';
import { useToast } from './toast';

const inputClass =
  'mt-1.5 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-[13px] text-paper placeholder:text-faint focus:border-accent focus:outline-none';
const primaryButtonClass =
  'rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-on-accent hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40';
const secondaryButtonClass =
  'rounded-full border border-hairline px-4 py-1.5 text-[13px] text-muted hover:border-faint hover:text-paper disabled:cursor-not-allowed disabled:opacity-40';

export function CreatePlaylistDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (playlist: PlaylistInfo) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const { show, showError } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const playlist = await api.createPlaylist({
        name: trimmed,
        description: description.trim() || undefined,
      });
      onOpenChange(false);
      setName('');
      setDescription('');
      show(t('lib.created'));
      onCreated(playlist);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('lib.createDialogTitle')}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="block text-xs text-muted" htmlFor="create-playlist-name">
          {t('lib.nameLabel')}
        </label>
        <input
          id="create-playlist-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('lib.namePlaceholder')}
          className={inputClass}
          required
        />
        <label className="mt-4 block text-xs text-muted" htmlFor="create-playlist-description">
          {t('lib.descriptionLabel')}
        </label>
        <textarea
          id="create-playlist-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t('lib.descriptionPlaceholder')}
          rows={3}
          className={`${inputClass} resize-y`}
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className={secondaryButtonClass}
          >
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={busy || !name.trim()} className={primaryButtonClass}>
            {busy ? t('lib.creating') : t('lib.createAction')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
