/**
 * 榜单卡（首页榜单区与 /charts 全览页共用）：可枚举有限电台源实例的
 * 内容化呈现——封面（有则显示，无则占位）+ 名称 + 副行（目录 detail 或
 * 已知源规格的本地文案）。整卡点击进入该源的集合页（/source/:spec）。
 * 需要凭据而服务端缺失时禁用（与首页集合卡同款门槛）。
 */
import { type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ListMusic } from 'lucide-react';
import type { RadioCatalogEntry } from '../api/types';
import { coverSrc } from './cover';
import { CoverThumb } from './CoverThumb';
import { SOURCE_DESC_KEYS } from './radioSources';

export function ChartCard({
  entry,
  credentialOk,
  className = 'w-full',
}: {
  entry: RadioCatalogEntry;
  /** 该 entry.provider 的凭据状态（capabilities.credential_status === 'ok'） */
  credentialOk: boolean;
  /** 外层宽度控制：首页网格省略；全览页网格省略 */
  className?: string;
}): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const usable = !entry.requires_credential || credentialOk;

  // 副行：目录 detail 优先；静态源无 detail 时回退本地源规格文案（spec 去 provider 前缀）。
  const specName = entry.spec.startsWith(`${entry.provider}:`)
    ? entry.spec.slice(entry.provider.length + 1)
    : entry.spec;
  const descKey = SOURCE_DESC_KEYS[specName];
  const subtitle = entry.detail ?? (descKey ? t(descKey) : undefined);

  return (
    <button
      type="button"
      disabled={!usable}
      title={usable ? undefined : t('radio.credentialNeed')}
      onClick={() => navigate(`/source/${encodeURIComponent(entry.spec)}`)}
      className={`group block rounded-lg p-3 text-left transition-colors hover:bg-panel-2 disabled:opacity-40 ${className}`}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md transition-shadow group-hover:shadow-[inset_0_0_0_1px_var(--rail)]">
        {entry.cover_url ? (
          <CoverThumb
            src={coverSrc(entry.cover_url)}
            alt={entry.name}
            className="h-full w-full rounded-md"
          />
        ) : (
          <span className="grid h-full w-full place-items-center bg-panel-2 text-faint">
            <ListMusic className="h-7 w-7" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="mt-3 truncate text-[15px] font-semibold text-paper">{entry.name}</div>
      {subtitle && <div className="mt-1 line-clamp-2 text-[13px] text-muted">{subtitle}</div>}
    </button>
  );
}
