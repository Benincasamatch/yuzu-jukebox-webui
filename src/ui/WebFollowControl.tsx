import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { isWebPlayback, setWebFollow, subscribeWebFollow, webFollowEnabled } from '../app/player';

export function WebFollowControl() {
  const { t } = useTranslation();
  const follows = useSyncExternalStore(subscribeWebFollow, webFollowEnabled);
  if (!isWebPlayback) return null;
  return (
    <div className="web-follow-control">
      <span><span className="web-follow-title">{t('home.webFollow')}</span><span className="web-follow-note">{t('home.webFollowHint')}</span></span>
      <button type="button" role="switch" aria-checked={follows} aria-label={t('home.webFollow')} className="web-follow-switch" onClick={() => setWebFollow(!follows)}>
        <span className="web-follow-thumb" />
      </button>
    </div>
  );
}
