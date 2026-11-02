/**
/** 移动端外壳（<md）：顶栏（可返回时返回钮 + 账户）、内容区、
 * 紧凑播放条、底部 TabBar（首页 / 搜索 / 曲库）。
 * 与桌面壳共用 shell/state.ts 的壳状态与播放接线——内核仍是组合根单例。
 * 管理功能（/admin）按需求不带入移动端。
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Home, Library, Search } from 'lucide-react';
import { useConnStatus } from './hooks';
import { ShellContext } from './shellContext';
import { useShellState } from './shell/state';
import { AppDownloadLink } from './AppDownloadLink';
import { AccountMenu } from './AccountMenu';
import { BatteryOptBanner } from './BatteryOptBanner';
import { MobilePlayerBar } from './MobilePlayerBar';
import { MobileRoomDialog } from './MobileRoomDialog';
import { QueueDrawer } from './shell/QueueDrawer';

export default function MobileShell() {
  const { t } = useTranslation();
  const status = useConnStatus();
  const value = useShellState();
  const navigate = useNavigate();
  const location = useLocation();
  // 历史栈首条的 key 恒为 default：非首条 = 可返回（深链着陆不可返回）
  const canGoBack = location.key !== 'default';

  // 顶栏随滚动隐现（Spotify 移动惯例）：向下滚出让内容位，向上滚/回顶复现。
  // 方向翻转才改 state，滚动途中不重渲染。
  const mainRef = useRef<HTMLElement | null>(null);
  const lastScrollTop = useRef(0);
  const [headerVisible, setHeaderVisible] = useState(true);
  useEffect(() => {
    // 换页回顶：顶栏复位可见
    lastScrollTop.current = 0;
    setHeaderVisible(true);
  }, [location.pathname]);
  const onMainScroll = () => {
    const top = mainRef.current?.scrollTop ?? 0;
    const dy = top - lastScrollTop.current;
    lastScrollTop.current = top;
    if (top <= 8 || dy < -4) setHeaderVisible(true);
    else if (dy > 4 && top > 48) setHeaderVisible(false);
  };

  return (
    <ShellContext.Provider value={value}>
      <div className="app-mobile flex h-dvh flex-col">
        {(status === 'reconnecting' || status === 'offline') && (
          <div className="bg-accent-soft py-1 text-center text-[12.5px] text-accent">
            {t(status === 'offline' ? 'conn.offline' : 'conn.reconnecting')}
          </div>
        )}

        {/* 内容区：整高滚动；顶栏与底部 chrome 都是浮层，hero 页（歌单/歌手）
            的渐变直抵屏幕顶（Spotify 移动沉浸形态），普通页自带 --header-h 上留白 */}
        <div className="relative min-h-0 flex-1">
          <main
            ref={mainRef}
            onScroll={onMainScroll}
            className="h-full overflow-y-auto pb-[calc(var(--chrome-b)+2.5rem)]"
          >
            <Outlet />
          </main>

          {/* 顶部渐变模糊幕（edge-to-edge 状态栏区）：滚动内容在系统图标前
              淡出消失；mask 让着色+模糊向下渐隐，hero 渐变透出不受遮挡。
              顶栏按钮层 z-20 在幕之上 */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[calc(env(safe-area-inset-top)+3.5rem)] bg-gradient-to-b from-[color-mix(in_srgb,var(--hall)_65%,transparent)] to-transparent backdrop-blur-md [-webkit-mask-image:linear-gradient(to_bottom,black,transparent)] mask-image:linear-gradient(to bottom,black,transparent)"
          />

          {/* 顶栏浮层：透明压在内容上；可返回时返回钮（半透明圆底保可读性），
              账户菜单居右。搜索在底部 TabBar，主题收进账户菜单，管理不带入移动端 */}
          <header
            className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] transition-[transform,opacity] duration-200 ${
              headerVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
            }`}
          >
            {canGoBack && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label={t('common.back')}
                title={t('common.back')}
                className="pointer-events-auto grid h-8 w-8 flex-none place-items-center rounded-full bg-hall/70 text-paper backdrop-blur-sm transition hover:bg-hall"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            <div className="pointer-events-auto"><AppDownloadLink /></div>
            <div className="flex-1" />
            <div className="pointer-events-auto">
              <AccountMenu compact themeInMenu onRoomsClick={() => value.setRoomsOpen(true)} />
            </div>
          </header>

          {/* 底部 chrome 浮层（Spotify 移动形态）：内容滚入渐变淡出区，
              悬浮播放条 + TabBar 叠在壳底色上 */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0">
            <div className="h-10 bg-gradient-to-b from-transparent to-hall" />
            <div className="mobile-chrome pointer-events-auto">
              <MobilePlayerBar />
              <MobileTabBar />
            </div>
          </div>
        </div>

        <QueueDrawer />
        <MobileRoomDialog open={value.roomsOpen} onOpenChange={value.setRoomsOpen} />
      </div>
      <BatteryOptBanner />
    </ShellContext.Provider>
  );
}

/** 移动底部 TabBar：首页 / 搜索 / 曲库。 */
function MobileTabBar() {
  const { t } = useTranslation();
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
      isActive ? 'text-accent' : 'text-muted'
    }`;

  return (
    <nav className="mobile-tabs flex flex-none pb-[env(safe-area-inset-bottom)] md:hidden">
      <NavLink to="/" end className={tabClass}>
        <Home className="h-5 w-5" />
        {t('shell.navHome')}
      </NavLink>
      <NavLink to="/search" className={tabClass}>
        <Search className="h-5 w-5" />
        {t('shell.navSearch')}
      </NavLink>
      <NavLink to="/library" className={tabClass}>
        <Library className="h-5 w-5" />
        {t('shell.library')}
      </NavLink>
    </nav>
  );
}
