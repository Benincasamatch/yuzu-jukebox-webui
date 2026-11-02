import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Volume2 } from 'lucide-react';
import { api } from '../app/session';
import { useToast } from './toast';

/** Room output volume, not this browser's <audio> volume. Commit on release/keyboard/blur. */
export function RoomVolumeControl({ roomId, disabled = false }: { roomId: string; disabled?: boolean }) {
  const { t } = useTranslation();
  const { showError } = useToast();
  const [volume, setVolume] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const saved = useRef<number | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    api.roomOutput(roomId).then((output) => {
      if (cancelled) return;
      saved.current = output.volume;
      setVolume(output.volume);
    }).catch((error: unknown) => {
      if (cancelled) return;
      setFailed(true);
      showError(error);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [roomId, disabled, retry, showError]);

  const commit = async (value: number) => {
    if (disabled || loading || failed || savingRef.current || value === saved.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await api.setRoomOutputVolume(roomId, value);
      saved.current = result.output.volume;
      setVolume(result.output.volume);
    } catch (error) {
      setVolume(saved.current);
      showError(error);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="room-volume-control">
      <label>
        <span className="room-volume-heading"><span><Volume2 size={14} aria-hidden="true" />{t('shell.roomVolume')}</span><output>{disabled || loading ? '—' : volume === null ? t('home.roomVolumeUnset') : `${volume}%`}</output></span>
        <input
          type="range" min={0} max={100} step={1} value={volume ?? 50}
          aria-label={t('shell.roomVolume')} aria-busy={saving}
          disabled={disabled || loading || failed || saving}
          onChange={(event) => setVolume(Number(event.target.value))}
          onPointerUp={(event) => void commit(Number(event.currentTarget.value))}
          onPointerCancel={() => setVolume(saved.current)}
          onBlur={(event) => void commit(Number(event.currentTarget.value))}
          onKeyUp={(event) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) void commit(Number(event.currentTarget.value));
          }}
        />
      </label>
      {failed && !disabled && <button type="button" className="text-xs text-accent" onClick={() => setRetry((v) => v + 1)}>{t('common.retry')}</button>}
    </div>
  );
}
