import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { oidcFlow, session, browserLoginFlow, tokenStore } from './app/session';
import { isBrowserLoginCallback } from './auth/browser';
import { isNativeApp } from './app/nativemedia';
import { initTheme } from './app/theme';
import { YuzuError } from './protocol/types';
import LoginView from './ui/LoginView';
import ConnectionRecovery from './ui/ConnectionRecovery';
import AppShell from './ui/AppShell';
import MobileShell from './ui/MobileShell';
import HomeView from './ui/HomeView';
import SearchView from './ui/SearchView';
import ShelfView from './ui/ShelfView';
import ChartsView from './ui/ChartsView';
import PlaylistDetailView from './ui/PlaylistDetailView';
import ArtistView from './ui/ArtistView';
import ArtistDiscographyView from './ui/ArtistDiscographyView';
import SourceCollectionView from './ui/SourceCollectionView';
import LibraryView from './ui/LibraryView';
import RoomDeepLink from './ui/RoomDeepLink';
import AdminView from './ui/AdminView';
import { useMediaQuery } from './ui/hooks';
import { AndroidUpdatePrompt } from './ui/AndroidUpdatePrompt';
import { ScarletAtmosphere } from './ui/ScarletSkin';
import { ToastProvider } from './ui/toast';

initTheme();

/** 同 URL、视图层分离：断点互斥选择桌面壳 / 移动壳，内核单例在壳之上共享。 */
function ResponsiveShell() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  return isDesktop ? <AppShell /> : <MobileShell />;
}

type Phase = 'boot' | 'login' | 'ready' | 'retry';

/** 启动时识别 OAuth 回调（PKCE redirect_uri = 应用根，code/state 落在 location.search） */
function isOidcCallback(): boolean {
  const params = new URLSearchParams(location.search);
  return params.has('code') || params.has('state') || params.has('error');
}

/** Web 启动时优先恢复 Yuzu token；没有 token 时尝试用 102 统一认证 Cookie 换取会话。 */
async function bootWebSession(): Promise<boolean> {
  if (await session.boot()) return true;
  try {
    await session.loginUnified();
    return true;
  } catch {
    return false;
  }
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [oidcError, setOidcError] = useState<YuzuError | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);

  // OAuth 回调统一处理（Web 的 location 回调与原生 scheme 回调共用）：
  // token 交换成功 → 登入并进 ready；无回调 → 保持现有阶段。
  const handleOidcCallback = async (url: string): Promise<boolean> => {
    const tokens = await oidcFlow.handleCallback(url);
    if (tokens === null) return false;
    await session.loginOidc(tokens.idToken, tokens.accessToken);
    return true;
  };

  useEffect(() => {
    setPhase('boot');
    // 原生平台：IdP 以自定义 scheme（yuzu-jukebox://oauth?code=…）拉起 App，
    // 经 appUrlOpen 事件到达；监听持续到卸载，以支持登出后再次登录。
    if (isNativeApp) {
      let listener: { remove: () => Promise<void> } | null = null;
      let disposed = false;
      const handleAppUrl = async (url: string) => {
        if (isBrowserLoginCallback(url) && browserLoginFlow) {
          // Android may retain the original launch Intent after a completed login.
          // An already-consumed callback must not replace a persisted session.
          if (!browserLoginFlow.hasPendingCallback(url)) return;
          try {
            await browserLoginFlow.handleCallback(url);
            await Browser.close().catch(() => {});
            const ok = await session.boot();
            if (!disposed) setPhase(ok ? 'ready' : 'login');
          } catch (err) {
            if (!disposed) {
              setOidcError(err instanceof YuzuError ? err : new YuzuError('unknown', String(err)));
              setPhase(tokenStore.get() ? 'retry' : 'login');
            }
          }
          return;
        }
        const target = new URL(url);
        if (target.protocol !== 'yuzu-jukebox:' || target.hostname !== 'oauth') return;
        const params = new URL(url).searchParams;
        if (!params.has('code') && !params.has('state') && !params.has('error')) return;
        void handleOidcCallback(url)
          .then((ok) => setPhase(ok ? 'ready' : 'login'))
          .catch((err: unknown) => {
            setOidcError(err instanceof YuzuError ? err : new YuzuError('unknown', String(err)));
            setPhase('login');
          });
      };
      CapacitorApp.addListener('appUrlOpen', ({ url }) => {
        void handleAppUrl(url);
      }).then((handle) => {
        if (disposed) void handle.remove();
        else listener = handle;
      });
      void CapacitorApp.getLaunchUrl().catch(() => undefined).then(async (launch) => {
        if (disposed) return;
        if (launch?.url && browserLoginFlow?.hasPendingCallback(launch.url)) {
          await handleAppUrl(launch.url);
        } else {
          const ok = await session.boot();
          if (!disposed) setPhase(session.getIdentity() || ok ? 'ready' : 'login');
        }
      }).catch(() => {
        if (!disposed) setPhase('retry');
      });
      return () => {
        disposed = true;
        void listener?.remove();
      };
    }

    // Web：redirect_uri = 应用根，code/state 落在 location.search
    const cleanUrl = () => history.replaceState(null, '', location.pathname + location.hash);
    if (isOidcCallback()) {
      handleOidcCallback(location.href)
        .then(async (ok) => {
          cleanUrl();
          if (ok) {
            setPhase('ready');
            return;
          }
          const booted = await bootWebSession();
          setPhase(booted ? 'ready' : 'login');
        })
        .catch((err: unknown) => {
          cleanUrl();
          setOidcError(err instanceof YuzuError ? err : new YuzuError('unknown', String(err)));
          setPhase('login');
        });
      return;
    }
    let disposed = false;
    void bootWebSession().then((ok) => {
      if (!disposed) setPhase(ok ? 'ready' : 'login');
    }).catch(() => {
      if (!disposed) setPhase('retry');
    });
    return () => { disposed = true; };
  }, [bootAttempt]);

  useEffect(() => {
    if (phase !== 'retry') return;
    const retry = () => setBootAttempt((attempt) => attempt + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [phase]);

  // 登出（identity 变 null）后回到登录页
  useEffect(() => {
    return session.subscribe(() => {
      if (session.getIdentity() !== null) setPhase('ready');
      else if (phase === 'ready') setPhase('login');
    });
  }, [phase]);

  if (phase === 'boot') return null;

  return (
    <ToastProvider>
      <ScarletAtmosphere />
      <AndroidUpdatePrompt />
      {phase === 'retry' ? (
        <ConnectionRecovery onRetry={() => setBootAttempt((attempt) => attempt + 1)} />
      ) : phase === 'login' ? (
        <LoginView oidcError={oidcError} />
      ) : (
        <HashRouter>
          <Routes>
            <Route element={<ResponsiveShell />}>
              <Route path="/" element={<HomeView />} />
              <Route path="/search" element={<SearchView />} />
              <Route path="/shelf/:kind" element={<ShelfView />} />
              <Route path="/charts" element={<ChartsView />} />
              <Route path="/playlist/:playlistId" element={<PlaylistDetailView />} />
              <Route path="/artist/:name/discography" element={<ArtistDiscographyView />} />
              <Route path="/artist/:name" element={<ArtistView />} />
              <Route path="/source/:spec" element={<SourceCollectionView />} />
              <Route path="/library" element={<LibraryView />} />
              {/* 旧 /room/:id 链接的兼容入口：同样只承担「切房」动作 */}
              <Route path="/r/:roomId" element={<RoomDeepLink />} />
              <Route path="/room/:roomId" element={<RoomDeepLink />} />
            </Route>
            <Route path="/admin" element={<AdminView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      )}
    </ToastProvider>
  );
}
