/**
/** 移动端外壳（<md）：顶栏（可返回时返回钮 + 账户）、内容区、
 * 紧凑播放条、底部 TabBar（首页 / 搜索 / 曲库）。
 * 与桌面壳共用 shell/state.ts 的壳状态与播放接线——内核仍是组合根单例。
 * 管理功能（/admin）按需求不带入移动端。
 */
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Home, Library, Search } from 'lucide-react';
import { useConnStatus } from './hooks';
import { ShellContext } from './shellContext';
import { useShellState } from './shell/state';
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

  return (
    <ShellContext.Provider value={value}>
      <div className="flex h-dvh flex-col">
        {(status === 'reconnecting' || status === 'offline') && (
          <div className="bg-accent-soft py-1 text-center text-[12.5px] text-accent">
            {t(status === 'offline' ? 'conn.offline' : 'conn.reconnecting')}
          </div>
        )}

        {/* 移动顶栏：可返回时返回钮（无分割线、无品牌字）；搜索在底部 TabBar，
            主题收进账户菜单，管理不带入移动端 */}
        <header className="flex flex-none items-center gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
          {canGoBack && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={t('common.back')}
              title={t('common.back')}
              className="grid h-8 w-8 flex-none place-items-center rounded-full text-paper transition hover:bg-[var(--hover)]"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <div className="flex-1" />
          <AccountMenu compact themeInMenu onRoomsClick={() => value.setRoomsOpen(true)} />
        </header>

        {/* 内容区：整高滚动，底部留白让位浮层 chrome（--chrome-b + 渐变淡出区） */}
        <div className="relative min-h-0 flex-1">
          <main className="h-full overflow-y-auto pb-[calc(var(--chrome-b)+2.5rem)]">
            <Outlet />
          </main>

          {/* 底部 chrome 浮层（Spotify 移动形态）：内容滚入渐变淡出区，
              悬浮播放条 + TabBar 叠在壳底色上 */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0">
            <div className="h-10 bg-gradient-to-b from-transparent to-hall" />
            <div className="pointer-events-auto bg-hall">
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
    `flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] transition-colors ${
      isActive ? 'text-accent' : 'text-muted'
    }`;

  return (
    <nav className="flex flex-none pb-[env(safe-area-inset-bottom)] md:hidden">
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
