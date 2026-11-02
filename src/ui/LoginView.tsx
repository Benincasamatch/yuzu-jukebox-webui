import { useEffect, useState } from 'react';
import { Headphones, Music2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OidcConfig, UnifiedAuthConfig } from '../api/types';
import { requestAndroidUpdateCheck } from '../app/androidUpdate';
import { AppDownloadLink } from './AppDownloadLink';
import { httpBase, oidcClientId } from '../config';
import { YuzuError } from '../protocol/types';
import { api, oidcFlow, browserLoginFlow } from '../app/session';
import { isNativeApp } from '../app/nativemedia';
import { errorKey } from './errors';
import { ServerAddressEditor } from './ServerSettings';

/** Zitadel roles scope：让 roles 随 token 下发，不依赖 console 应用级设置 */
const OIDC_SCOPES = ['urn:zitadel:iam:org:projects:roles'];

export default function LoginView({ oidcError }: { oidcError: YuzuError | null }) {
  const { t } = useTranslation();
  const [error, setError] = useState<YuzuError | null>(oidcError);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [oidc, setOidc] = useState<OidcConfig | null>(null);
  const [unified, setUnified] = useState<UnifiedAuthConfig | null>(null);
  const [serverEditorOpen, setServerEditorOpen] = useState(false);

  useEffect(() => {
    setError(oidcError);
  }, [oidcError]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      api.oidcConfig().catch(() => null),
      api.unifiedAuthConfig().catch(() => null),
    ]).then(([oidcConfig, unifiedConfig]) => {
      if (!active) return;
      setOidc(oidcConfig);
      setUnified(unifiedConfig);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const startUnified = async (provider: 'sso' | 'local' = 'local') => {
    if (!unified || busy) return;
    setError(null);
    setBusy(true);
    try {
      if (browserLoginFlow) {
        await browserLoginFlow.begin(provider);
        return;
      }
      const loginURL = new URL(unified.login_url, httpBase || location.origin);
      if (provider === 'sso') loginURL.pathname = loginURL.pathname.replace(/\/+$/, '') + '/zitadel';
      loginURL.searchParams.set('next', location.href);
      location.assign(loginURL.toString());
    } catch (err) {
      setBusy(false);
      setError(err instanceof YuzuError ? err : new YuzuError('unknown', String(err)));
    } finally {
      setBusy(false);
    }
  };

  const startOidc = async () => {
    if (unified && (!isNativeApp || unified.browser_login)) {
      await startUnified('sso');
      return;
    }
    if (!oidc || busy) return;
    setBusy(true);
    setError(null);
    try {
      await oidcFlow.begin(oidc, {
        clientId: oidcClientId || undefined,
        scopes: OIDC_SCOPES,
      });
    } catch (err) {
      setError(err instanceof YuzuError ? err : new YuzuError('unknown', String(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen min-h-dvh grid place-items-center px-6 py-10">
      <div className="login-card w-full max-w-sm">
        <div className="mb-5 flex justify-end"><AppDownloadLink />{isNativeApp && <button type="button" className="text-xs text-muted" onClick={requestAndroidUpdateCheck}>{t('updates.check')}</button>}</div>
        <div className="login-symbol" aria-hidden="true"><Music2 className="h-9 w-9" /></div>
        <div className="text-sm font-medium tracking-wide text-muted mb-3">
          Yuzu Jukebox
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight mb-3">{t('login.title')}</h1>
        <p className="mb-8 text-sm leading-relaxed text-muted">{t('home.heroDescription')}</p>

        {error && (
          <p className="text-sm text-[#D05A4E] mb-4">{t(errorKey(error), { message: error.message })}</p>
        )}

        <div className="space-y-3" aria-busy={loading || busy}>
          <button
            type="button"
            onClick={() => void startOidc()}
            disabled={loading || busy || (!oidc && !(unified && (!isNativeApp || unified.browser_login)))}
            className="w-full min-h-12 bg-accent text-on-accent font-semibold rounded-xl py-3 disabled:opacity-40 hover:brightness-105"
          >
            {t('login.oidcButton')}
          </button>
          <button
            type="button"
            onClick={() => void startUnified()}
            disabled={loading || busy || !unified || (isNativeApp && !unified.browser_login)}
            className="w-full min-h-12 border border-hairline bg-panel-2/50 text-paper font-medium rounded-xl py-3 hover:text-paper hover:border-faint disabled:opacity-40"
          >
            {t('login.unifiedButton')}
          </button>
        </div>
        {loading ? (
          <p role="status" className="mt-4 text-xs text-faint">{t('common.loading')}</p>
        ) : (
          <div role="status" className="mt-4 space-y-2 text-xs text-faint">
            {!oidc && !(unified && (!isNativeApp || unified.browser_login)) && <p>{t('login.oidcUnavailable')}</p>}
            {isNativeApp && unified && !unified.browser_login && <p>{t('login.browserLoginUnavailable')}</p>}
            {!unified && <p>{t('login.account102Unavailable')}</p>}
            {unified && (!isNativeApp || unified.browser_login) && <p>{t('login.browserLoginHint')}</p>}
          </div>
        )}

        <p className="login-footer mt-8 flex items-center justify-center gap-2 text-xs text-muted"><Headphones className="h-4 w-4" aria-hidden="true" />{t('home.sharedListening')}</p>
        {isNativeApp && (
          <div className="mt-8 border-t border-hairline pt-4 font-mono text-[11px] text-faint">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0">{t('serverPicker.label')}</span>
              <span className="min-w-0 flex-1 truncate">{httpBase || t('serverPicker.unset')}</span>
              <button
                type="button"
                onClick={() => setServerEditorOpen(true)}
                className="shrink-0 text-muted hover:text-paper"
              >
                {t('serverPicker.change')}
              </button>
            </div>
            {serverEditorOpen && (
              <div className="mt-3">
                <ServerAddressEditor onCancel={() => setServerEditorOpen(false)} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
