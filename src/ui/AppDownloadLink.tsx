import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { androidDownloadUrl } from '../config';
import { isNativeApp } from '../app/nativemedia';

export function AppDownloadLink() {
  const { t } = useTranslation();
  if (isNativeApp) return null;
  return <a className="app-download-link" href={androidDownloadUrl} target="_blank" rel="noopener noreferrer" title={t('updates.downloadApp')}><Download size={15} aria-hidden="true" /><span>{t('updates.downloadApp')}</span></a>;
}
