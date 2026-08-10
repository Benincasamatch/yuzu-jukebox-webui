/**
 * 桌面播放器外壳（Spotify 三栏）：左曲库栏、主面板（顶栏 sticky + 内容）、
 * 右 Now Playing 栏、底部播放栏、队列抽屉。面板以黑色缝隙分隔，无 border。
 * 壳状态（房间动作/播放授权/播放接线）抽到 shell/state.ts，与移动壳共用；
 * 房间从「页面」降级为「状态」——播放接线常驻，页面切换不影响出声。
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { DropdownMenu } from 'radix-ui';
import { Check, ChevronDown, ChevronLeft, Home, Search as SearchIcon, X } from 'lucide-react';
import { api } from '../app/session';
import { useConnStatus, useIdentity } from './hooks';
import { AccountMenu } from './AccountMenu';
import { BatteryOptBanner } from './BatteryOptBanner';
import ThemeControls from './ThemeControls';
import { LibraryRail } from './shell/LibraryRail';
import { NowPlayingPanel } from './shell/NowPlayingPanel';
import { PlayerBar } from './shell/PlayerBar';
import { QueuePanelContent } from './shell/QueueDrawer';
import { RoomPickerContent } from './shell/RoomPickerContent';
import { SEARCH_PROVIDER_KEY, ShellContext } from './shellContext';
import { useShellState } from './shell/state';

export { useShell } from './shellContext';
export { SEARCH_PROVIDER_KEY } from './shellContext';
export type { JoinResult } from './shellContext';

/** 三栏宽度约束与持久化键（桌面壳；拖拽分界线的 min/max 钳制）。 */
const RAIL_MIN = 200;
const RAIL_MAX = 420;
const PANEL_MIN = 280;
const PANEL_MAX = 480;
const RAIL_W_KEY = 'yuzu-rail-w';
const PANEL_W_KEY = 'yuzu-panel-w';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const readWidth = (key: string, fallback: number, min: number, max: number) => {
  const raw = Number(localStorage.getItem(key));
  return Number.isFinite(raw) && raw > 0 ? clamp(raw, min, max) : fallback;
};

export default function AppShell() {
  const { t } = useTranslation();
  const value = useShellState();
  const status = useConnStatus();
  const [railW, setRailW] = useState(() => readWidth(RAIL_W_KEY, 288, RAIL_MIN, RAIL_MAX));
  const [panelW, setPanelW] = useState(() => readWidth(PANEL_W_KEY, 360, PANEL_MIN, PANEL_MAX));
  // 拖拽起点宽度：pointerdown 时捕获，拖动中按增量钳制
  const capturedRailW = useRef(288);
  const capturedPanelW = useRef(360);

  return (
    <ShellContext.Provider value={value}>
      <div className="flex h-dvh flex-col gap-2 bg-hall p-2">
        {(status === 'reconnecting' || status === 'offline') && (
          <div className="flex-none rounded-lg bg-accent-soft py-1.5 text-center text-sm text-accent">
            {t(status === 'offline' ? 'conn.offline' : 'conn.reconnecting')}
          </div>
        )}

        <TopBar />

        <div className="flex min-h-0 flex-1">
          <div className="h-full flex-none max-lg:hidden" style={{ width: railW }}>
            <LibraryRail />
          </div>
          <ColumnDivider
            onStart={() => {
              capturedRailW.current = railW;
            }}
            onDrag={(dx) => setRailW(clamp(capturedRailW.current + dx, RAIL_MIN, RAIL_MAX))}
            onEnd={() => localStorage.setItem(RAIL_W_KEY, String(railW))}
          />
          <main className="min-w-0 flex-1 overflow-y-auto rounded-lg bg-panel">
            <Outlet />
          </main>
          {value.rightPanel !== 'nowPlaying' || !value.nowPlayingCollapsed ? (
            <ColumnDivider
              onStart={() => {
                capturedPanelW.current = panelW;
              }}
              onDrag={(dx) =>
                setPanelW(clamp(capturedPanelW.current - dx, PANEL_MIN, PANEL_MAX))
              }
              onEnd={() => localStorage.setItem(PANEL_W_KEY, String(panelW))}
            />
          ) : (
            <div className="w-2 flex-none max-lg:hidden" />
          )}
          {value.rightPanel === 'queue' && (
            <aside
              className="flex-none overflow-hidden rounded-lg bg-panel max-lg:hidden"
              style={{ width: panelW }}
            >
              <QueuePanelContent onClose={() => value.setRightPanel('nowPlaying')} />
            </aside>
          )}
          {value.rightPanel === 'rooms' && (
            <aside
              className="flex-none overflow-hidden rounded-lg bg-panel max-lg:hidden"
              style={{ width: panelW }}
            >
              <RoomsPanel onClose={() => value.setRightPanel('nowPlaying')} />
            </aside>
          )}
          {value.rightPanel === 'nowPlaying' &&
            (value.nowPlayingCollapsed ? (
              <CollapsedNowPlaying onExpand={() => value.setNowPlayingOpen(true)} />
            ) : (
              <aside
                className="flex-none overflow-hidden rounded-lg bg-panel max-lg:hidden"
                style={{ width: panelW }}
              >
                <NowPlayingPanel />
              </aside>
            ))}
        </div>

        <PlayerBar />
      </div>
      <BatteryOptBanner />
    </ShellContext.Provider>
  );
}

/** 顶栏：provider 下拉 + 搜索框（意图入口）+ 管理/主题 + 账户菜单。窄屏时兼作导航条。 */
function TopBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [keyword, setKeyword] = useState('');
  const [providers, setProviders] = useState<string[]>([]);
  const [provider, setProvider] = useState(
    () => localStorage.getItem(SEARCH_PROVIDER_KEY) ?? 'ncm',
  );

  // provider 列表就绪后校正记忆值：非法值回退 ncm → 首个可用
  useEffect(() => {
    api
      .listProviders()
      .then((list) => {
        const ids = list.map((item) => item.id);
        setProviders(ids);
        setProvider((current) => {
          if (ids.includes(current)) return current;
          const next = ids.includes('ncm') ? 'ncm' : (ids[0] ?? current);
          localStorage.setItem(SEARCH_PROVIDER_KEY, next);
          return next;
        });
      })
      .catch(() => {});
  }, []);

  const goSearch = (q: string, p: string) => {
    if (q) navigate(`/search?q=${encodeURIComponent(q)}&p=${encodeURIComponent(p)}`);
  };

  const changeProvider = (id: string) => {
    setProvider(id);
    localStorage.setItem(SEARCH_PROVIDER_KEY, id);
    // 已在搜索页且有查询词：立即用新 provider 重搜
    if (location.pathname === '/search') goSearch(params.get('q')?.trim() ?? '', id);
  };

  return (
    <header className="flex flex-none items-center gap-4 py-2">
      {/* 左：品牌文字占位（Spotify logo 位），与左曲库栏同宽对齐 */}
      <NavLink to="/" className="flex w-72 flex-none items-center pl-2">
        <span className="text-lg font-bold tracking-tight text-paper">
          Yuzu <span className="text-accent">Jukebox</span>
        </span>
      </NavLink>

      {/* 中：主页钮 + 搜索胶囊（居中组） */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
        <NavLink
          to="/"
          title={t('shell.navHome')}
          className="grid h-10 w-10 flex-none place-items-center rounded-full bg-panel text-muted transition-colors hover:text-paper"
        >
          <Home className="h-5 w-5" />
        </NavLink>
        <form
          className="flex h-10 w-full max-w-[480px] items-center rounded-full bg-panel transition-shadow focus-within:ring-2 focus-within:ring-paper hover:ring-1 hover:ring-hairline"
          onSubmit={(event) => {
            event.preventDefault();
            goSearch(keyword.trim(), provider);
          }}
        >
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                title={t('searchPage.providerPick')}
                className="flex flex-none items-center gap-1 rounded-l-full py-1.5 pr-2 pl-3.5 font-mono text-[12px] text-muted hover:text-paper"
              >
                {provider}
                <ChevronDown className="h-3 w-3 text-faint" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={8}
                className="menu-content z-50 min-w-28 rounded-lg border border-hairline bg-panel-2 p-1.5"
              >
                {providers.map((id) => (
                  <DropdownMenu.Item
                    key={id}
                    onSelect={() => changeProvider(id)}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 font-mono text-[12.5px] text-muted outline-none data-[highlighted]:bg-[var(--hover)] data-[highlighted]:text-paper"
                  >
                    {id}
                    {id === provider && <Check className="h-3.5 w-3.5 text-accent" />}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <span className="h-4 w-px flex-none bg-hairline" />
          <SearchIcon className="pointer-events-none ml-2.5 h-4 w-4 flex-none text-faint" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t('search.placeholder')}
            className="search-input w-full min-w-0 bg-transparent py-1.5 pr-3 pl-2 text-[13.5px] placeholder:text-faint focus:outline-none"
          />
        </form>
      </div>

      {/* 右：管理 / 主题 / 账户（Spotify 同款：账户只露头像） */}
      <div className="flex w-72 flex-none items-center justify-end gap-3 pr-2">
        <AdminEntry />
        <ThemeControls />
        <AccountMenu compact />
      </div>
    </header>
  );
}

/**
 * 栏间分界线（桌面）：8px 黑缝即拖拽热区，hover/drag 亮起中线；
 * pointer capture 拖动，增量经 onDrag 上报（钳制与持久化由调用方负责）。
 */
function ColumnDivider({
  onStart,
  onDrag,
  onEnd,
}: {
  onStart: () => void;
  onDrag: (dx: number) => void;
  onEnd: () => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className="group flex w-2 flex-none cursor-col-resize justify-center max-lg:hidden"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const handle = event.currentTarget;
        const startX = event.clientX;
        handle.setPointerCapture(event.pointerId);
        onStart();
        const move = (ev: PointerEvent) => onDrag(ev.clientX - startX);
        const up = () => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', up);
          handle.removeEventListener('pointercancel', up);
          onEnd();
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
        handle.addEventListener('pointercancel', up);
      }}
    >
      <div className="w-px bg-transparent transition-colors group-hover:bg-hairline group-active:bg-muted" />
    </div>
  );
}

/**
 * Now Playing 折叠轨（Spotify 同款）：真实布局宽度（非浮层），悬停时
 * 40→64px 轻微加宽，纯黑分界随宽度一起移动；轨内半透明透出面板右缘
 * 幽灵内容，点击任意处展开回完整面板。
 */
function CollapsedNowPlaying({ onExpand }: { onExpand: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="group relative h-full w-10 flex-none overflow-hidden rounded-lg bg-panel transition-all duration-200 hover:w-16 max-lg:hidden">
      {/* 幽灵内容：右缘对齐裁切，悬停加深；不可交互（喜欢/关闭等钮在展开态才可达） */}
      <div className="pointer-events-none absolute inset-0 opacity-25 transition-opacity duration-200 group-hover:opacity-50 [&_*]:!select-none">
        <span className="absolute inset-y-0 right-0 block w-[360px]">
          <NowPlayingPanel />
        </span>
      </div>
      <button
        type="button"
        title={t('np.expand')}
        aria-label={t('np.expand')}
        onClick={onExpand}
        className="absolute inset-0 grid w-full cursor-pointer place-items-center"
      >
        <ChevronLeft className="h-5 w-5 text-muted transition-colors group-hover:text-paper" />
      </button>
    </div>
  );
}

/** 右槽位的房间面板（Spotify Connect 对应物）：头部 + 共享 RoomPickerContent。 */
function RoomsPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-none items-center gap-3 px-4 py-4">
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-paper">
          {t('shell.roomSwitch')}
        </p>
        <button
          type="button"
          title={t('np.close')}
          onClick={onClose}
          className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-[var(--hover)] hover:text-paper"
        >
          <X className="h-5 w-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <RoomPickerContent onClose={onClose} />
      </div>
    </div>
  );
}

function AdminEntry() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const identity = useIdentity();
  const isAdmin = identity?.roles.some((r) => r === 'room_admin' || r === 'media_admin') ?? false;
  if (!isAdmin) return null;
  return (
    <button onClick={() => navigate('/admin')} className="text-left text-[13px] text-muted hover:text-paper">
      {t('admin.entry')}
    </button>
  );
}
