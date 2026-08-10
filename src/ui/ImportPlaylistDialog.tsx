/**
 * 导入外部歌单对话框（LibraryRail 与 /admin 歌单管理共用，唯一实现）：
 * 两种模式——外部歌单（provider + ID/URL，可选绑定跟随）/ 曲目源快照。
 * 成功 toast 在本组件内统一，onImported 由调用方决定去向（跳转/刷新列表）。
 */
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlaylistInfo } from '../api/types';
import { api } from '../app/session';
import { useProviders } from './hooks';
import { Dialog, Select } from './primitives';
import { useToast } from './toast';

const inputClass =
  'mt-1.5 w-full rounded-md border border-hairline bg-panel px-3 py-2 text-[13px] text-paper placeholder:text-faint focus:border-accent focus:outline-none';
const primaryButtonClass =
  'rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-on-accent hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40';
const secondaryButtonClass =
  'rounded-full border border-hairline px-4 py-1.5 text-[13px] text-muted hover:border-faint hover:text-paper disabled:cursor-not-allowed disabled:opacity-40';

export function ImportPlaylistDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (playlist: PlaylistInfo) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const providers = useProviders();
  const { show, showError } = useToast();
  const [mode, setMode] = useState<'external' | 'source'>('external');
  const [provider, setProvider] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [source, setSource] = useState('');
  const [name, setName] = useState('');
  const [bind, setBind] = useState(false);
  const [busy, setBusy] = useState(false);

  // provider 列表就绪后校正记忆值：非法值回退 ncm → 首个可用
  useEffect(() => {
    if (!providers?.length || providers.some((item) => item.id === provider)) return;
    setProvider(providers.some((item) => item.id === 'ncm') ? 'ncm' : providers[0].id);
  }, [provider, providers]);

  // 每次打开重置表单（provider 保留校正结果）
  useEffect(() => {
    if (!open) return;
    setMode('external');
    setPlaylistId('');
    setSource('');
    setName('');
    setBind(false);
  }, [open]);

  const externalReady = provider !== '' && playlistId.trim() !== '';
  const ready = mode === 'external' ? externalReady : source.trim() !== '';

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const imported =
        mode === 'external' && bind
          ? await api.bindPlaylist({
              provider,
              playlist_id: playlistId.trim(),
              name: name.trim() || undefined,
            })
          : await api.importPlaylist(
              mode === 'external'
                ? { provider, playlist_id: playlistId.trim(), name: name.trim() || undefined }
                : { source: source.trim(), name: name.trim() || undefined },
            );
      onOpenChange(false);
      show(
        mode === 'external' && bind
          ? t('importDialog.bound', { name: imported.name })
          : t('importDialog.imported', { name: imported.name }),
      );
      onImported(imported);
    } catch (error: unknown) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('importDialog.title')}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="block text-xs text-muted">{t('importDialog.modeLabel')}</label>
        <Select
          value={mode}
          onValueChange={(value) => setMode(value as 'external' | 'source')}
          options={[
            { value: 'external', label: t('importDialog.external') },
            { value: 'source', label: t('importDialog.source') },
          ]}
          ariaLabel={t('importDialog.modeLabel')}
          className="mt-1.5 w-full"
        />
        {mode === 'external' ? (
          <div className="mt-4 grid gap-4">
            <label className="block text-xs text-muted">
              {t('importDialog.providerLabel')}
              <Select
                value={provider}
                onValueChange={setProvider}
                options={(providers ?? []).map((item) => ({ value: item.id, label: item.id }))}
                placeholder={t('importDialog.providerPlaceholder')}
                ariaLabel={t('importDialog.providerLabel')}
                className="mt-1.5 w-full"
              />
            </label>
            <label className="block text-xs text-muted">
              {t('importDialog.playlistIdLabel')}
              <input
                value={playlistId}
                onChange={(event) => setPlaylistId(event.target.value)}
                placeholder={
                  provider === 'ncm'
                    ? t('importDialog.playlistIdPlaceholder')
                    : provider === 'bili'
                      ? t('importDialog.playlistIdPlaceholderBili')
                      : t('importDialog.playlistIdPlaceholderGeneric', { provider })
                }
                className={inputClass}
                required
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={bind}
                onChange={(event) => setBind(event.target.checked)}
                className="yuzu-checkbox"
              />
              {t('importDialog.bindFollow')}
            </label>
          </div>
        ) : (
          <label className="mt-4 block text-xs text-muted">
            {t('importDialog.sourceLabel')}
            <input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder={t('importDialog.sourcePlaceholder')}
              className={inputClass}
              required
            />
          </label>
        )}
        <label className="mt-4 block text-xs text-muted">
          {t('importDialog.nameLabel')}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('importDialog.namePlaceholder')}
            className={inputClass}
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className={secondaryButtonClass}
          >
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={busy || !ready} className={primaryButtonClass}>
            {busy ? t('importDialog.working') : t('importDialog.action')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
