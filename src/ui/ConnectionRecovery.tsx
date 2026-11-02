import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { httpBase } from '../config';
import { isNativeApp } from '../app/nativemedia';
import { ServerAddressEditor } from './ServerSettings';

export default function ConnectionRecovery({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">{t('sessionRecovery.title')}</h1>
        <p role="status" className="my-4 text-sm text-muted">{t('sessionRecovery.description')}</p>
        <button type="button" onClick={onRetry} className="w-full rounded-full bg-accent py-2.5 text-on-accent">
          {t('sessionRecovery.retry')}
        </button>
        {isNativeApp && (
          <div className="mt-6 border-t border-hairline pt-4">
            <p className="break-all text-xs text-muted">{httpBase}</p>
            <button type="button" onClick={() => setEditing(true)} className="mt-2 text-sm text-muted">
              {t('serverPicker.change')}
            </button>
            {editing && <div className="mt-3"><ServerAddressEditor onCancel={() => setEditing(false)} /></div>}
          </div>
        )}
      </div>
    </div>
  );
}
