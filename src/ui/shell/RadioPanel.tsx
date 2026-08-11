/**
 * 电台状态条（队列面板底部）：电台启动/停止已下沉到内容面——
 * 榜单/集合页与歌单详情页的「以电台播放」（RadioPlayButton），
 * 这里只保留「正在漫游 + 停止」。无电台运行时渲染 null。
 */
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { roomStore } from '../../app/session';
import { useRoomState } from '../hooks';
import { useShell } from '../AppShell';
import { useToast } from '../toast';

export function RadioPanel(): JSX.Element | null {
  const { t } = useTranslation();
  const state = useRoomState();
  const { canRadio } = useShell();
  const { show, showError } = useToast();
  const radio = state.radio;
  const [busy, setBusy] = useState(false);

  if (!radio) return null;

  const stop = () => {
    if (busy) return;
    setBusy(true);
    void roomStore
      .radioStop()
      .then(() => show(t('roomAdmin.radioStopped')))
      .catch(showError)
      .finally(() => setBusy(false));
  };

  return (
    <div className="border-t border-hairline px-4.5 py-3">
      <div className="flex items-center gap-2 text-[12.5px]">
        <span className="h-1.5 w-1.5 flex-none animate-pulse rounded-full bg-accent" />
        <span className="min-w-0 truncate font-mono text-xs text-muted">
          {t('room.radioOn', { source: radio.source })}
        </span>
        {canRadio && (
          <button
            type="button"
            disabled={busy}
            onClick={stop}
            className="ml-auto flex-none text-xs text-faint hover:text-[#D05A4E] disabled:opacity-40"
          >
            {busy ? t('roomAdmin.radioStopping') : t('roomAdmin.radioStop')}
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-faint">{t('room.radioNote')}</p>
    </div>
  );
}
