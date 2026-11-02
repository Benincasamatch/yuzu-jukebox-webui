import { Folder, Music2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const brands: Record<string, { icon: string; label: 'ncm' | 'qq' | 'bili' }> = {
  ncm: { icon: 'ncm.svg', label: 'ncm' },
  qq: { icon: 'qq.ico', label: 'qq' },
  bili: { icon: 'bili.svg', label: 'bili' },
  bill: { icon: 'bili.svg', label: 'bili' },
  bilibili: { icon: 'bili.svg', label: 'bili' },
};

/** Presentation only: keep the server's original provider ID for requests and storage. */
export function ProviderLabel({ provider }: { provider: string }) {
  const { t } = useTranslation();
  const brand = brands[provider];
  return <span className="provider-label">
    {brand ? <img className="provider-icon" src={`provider-icons/${brand.icon}`} alt="" width={20} height={20} />
      : provider === 'local' ? <Folder className="provider-local-icon" size={20} aria-hidden="true" />
      : <Music2 size={20} aria-hidden="true" />}
    <span>{brand ? t(`searchPage.providers.${brand.label}`) : provider === 'local' ? t('searchPage.providers.local') : provider}</span>
  </span>;
}
