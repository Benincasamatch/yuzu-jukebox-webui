import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CapacitorHttp } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { androidUpdateUrl } from '../config';
import { isNativeApp } from '../app/nativemedia';
import { CHECK_ANDROID_UPDATE_EVENT, newerAndroidUpdate, type AndroidUpdate } from '../app/androidUpdate';
import { Dialog } from './primitives';
import { useToast } from './toast';

export function AndroidUpdatePrompt() {
  return isNativeApp ? <NativeUpdatePrompt /> : null;
}

function NativeUpdatePrompt() {
  const { t } = useTranslation();
  const { show } = useToast();
  const [update, setUpdate] = useState<AndroidUpdate | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const check = useCallback(async (manual: boolean) => {
    if (busy.current) { if (manual) show(t('updates.checking')); return; }
    busy.current = true;
    try {
      const installed = await CapacitorApp.getInfo();
      const url = new URL(androidUpdateUrl);
      if (url.protocol !== 'https:') throw new Error('HTTPS update feed required');
      url.searchParams.set('_', String(Date.now()));
      const response = await CapacitorHttp.get({ url: url.href, responseType: 'json', connectTimeout: 8000, readTimeout: 8000, headers: { 'Cache-Control': 'no-cache' } });
      if (response.status !== 200) throw new Error('Update feed unavailable');
      const next = newerAndroidUpdate(response.data, androidUpdateUrl, installed);
      if (!mounted.current) return;
      if (next && (manual || localStorage.getItem('yuzu-dismissed-update') !== String(next.versionCode))) setUpdate(next);
      else if (manual) show(t('updates.latest'));
    } catch {
      if (manual && mounted.current) show(t('updates.failed'));
    } finally { busy.current = false; }
  }, [show, t]);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => void check(false), 500);
    const manual = () => void check(true);
    window.addEventListener(CHECK_ANDROID_UPDATE_EVENT, manual);
    return () => { mounted.current = false; window.clearTimeout(timer); window.removeEventListener(CHECK_ANDROID_UPDATE_EVENT, manual); };
  }, [check]);

  const dismiss = () => {
    if (update) localStorage.setItem('yuzu-dismissed-update', String(update.versionCode));
    setUpdate(null);
  };
  return (
    <Dialog open={update !== null} onOpenChange={(open) => { if (!open) dismiss(); }} title={t('updates.available', { version: update?.versionName })}>
      <p className="mb-4 text-sm text-muted">{t('updates.installHint')}</p>
      {update?.notes && <p className="mb-5 whitespace-pre-line text-sm text-paper">{update.notes}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={dismiss} className="rounded-xl border border-hairline px-4 py-2 text-sm">{t('updates.later')}</button>
        <button type="button" onClick={() => { if (update) void Browser.open({ url: update.apkUrl }).catch(() => show(t('updates.failed'))); }} className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-on-accent">{t('updates.download')}</button>
      </div>
    </Dialog>
  );
}
