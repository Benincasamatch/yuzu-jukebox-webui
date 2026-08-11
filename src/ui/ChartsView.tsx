/**
 * 榜单全览页（/charts）：聚合电台源目录的全部可枚举有限源实例，
 * 首页只摆每 provider 前 2 个，「显示全部」跳到这里看全量。
 */
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { RadioCatalogEntry } from '../api/types';
import { api } from '../app/session';
import { ChartCard } from './ChartCard';
import { useProviders } from './hooks';
import { useToast } from './toast';

export default function ChartsView(): JSX.Element {
  const { t } = useTranslation();
  const providers = useProviders();
  const { showError } = useToast();
  const [entries, setEntries] = useState<RadioCatalogEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let dead = false;
    setFailed(false);
    api
      .radioCatalogAll()
      .then((rows) => {
        if (!dead) setEntries(rows);
      })
      .catch((error: unknown) => {
        if (dead) return;
        setFailed(true);
        showError(error);
      });
    return () => {
      dead = true;
    };
  }, [showError, reload]);

  return (
    <div className="view-enter px-4 pt-[calc(var(--header-h)+0.75rem)] pb-10 md:px-8 md:pt-6">
      <h1 className="text-[32px] font-bold text-paper">{t('home.chartsTitle')}</h1>

      {entries === null ? (
        <p className="mt-10 text-sm text-muted">{failed ? t('charts.loadFailed') : t('common.loading')}</p>
      ) : entries.length === 0 ? (
        <p className="mt-10 text-sm text-faint">{t('charts.empty')}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
          {entries.map((entry) => (
            <ChartCard
              key={entry.spec}
              entry={entry}
              credentialOk={
                (providers?.find((p) => p.id === entry.provider)?.credential_status ?? 'none') ===
                'ok'
              }
            />
          ))}
        </div>
      )}
      {failed && (
        <button
          type="button"
          onClick={() => setReload((value) => value + 1)}
          className="mt-4 rounded-full bg-panel-2 px-4 py-2 text-[13px] font-semibold text-paper transition hover:bg-[var(--hover)]"
        >
          {t('artistPage.retry')}
        </button>
      )}
    </div>
  );
}
