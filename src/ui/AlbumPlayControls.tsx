import { useRef, useState } from 'react';
import { Play, Shuffle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../app/session';
import { enqueueAlbum } from './albumPlayback';
import { useRoomState } from './hooks';
import { useShell } from './shellContext';
import { useToast } from './toast';

export function AlbumPlayControls({
  provider,
  albumId,
  disabled = false,
}: {
  provider: string;
  albumId: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { roomId } = useRoomState();
  const { setRoomsOpen } = useShell();
  const { show, showError } = useToast();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const play = (shuffle: boolean) => {
    if (inFlight.current || disabled) return;
    if (!roomId) {
      show(t('home.needRoom'));
      setRoomsOpen(true);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    void enqueueAlbum(
      (limit, offset) => api.searchEntity(provider, 'album', albumId, { limit, offset }),
      (refs) => api.addRoomQueue(roomId, refs),
      shuffle,
    )
      .then((count) => show(t('room.addedBatchToast', { count })))
      .catch(showError)
      .finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
  };

  return (
    <div className="my-4 flex flex-wrap items-center gap-3" aria-busy={busy}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => play(false)}
        title={t('artistPage.playAlbumHint')}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent transition hover:brightness-105 disabled:opacity-40"
      >
        <Play className="h-5 w-5 fill-current" aria-hidden="true" />
        {busy ? t('batch.adding') : t('artistPage.playAlbum')}
      </button>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => play(true)}
        title={t('artistPage.shuffleAlbumHint')}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted transition hover:bg-panel-2 hover:text-paper disabled:opacity-40"
      >
        <Shuffle className="h-5 w-5" aria-hidden="true" />
        {t('artistPage.shuffleAlbum')}
      </button>
    </div>
  );
}
