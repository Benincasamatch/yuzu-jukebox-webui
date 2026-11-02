/**
 * 全屏沉浸舞台：浏览器即画布。静态渐变背景由封面取色驱动；桌面端封面静止陈列，
 * chrome（关闭/点播者/时间）在活动后 2.8s 自动隐去（连同光标），底部通栏
 * 发丝进度线贯穿视口。播放位置永远由服务端五元组推算，无任何本地进度状态。
 * 纯观赏视图：桌面端无任何控制按钮（控制在 PlayerBar），歌词手动滚动
 * 接管焦点、停滚 5s 自动恢复跟踪（见 LyricsPanel）。
 */
import { useCallback, useEffect, useReducer, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Pause, Play } from 'lucide-react';
import { client } from '../app/session';
import { audio, renderer } from '../app/player';
import type { Playback } from '../protocol/types';
import type { LyricLine } from '../player/lyrics';
import { activeLineIndex } from '../player/lyrics';
import { useCoverColor } from './useCoverColor';
import { useMediaQuery } from './hooks';
import { ArtistLinks } from './artist';
import { coverSrc, originalCoverSrc } from './cover';
import { SimilarButton } from './SimilarButton';
import { pushOverlayCloser, removeOverlayCloser } from './backbutton';
import { LyricsPanel } from './LyricsPanel';
import { formatClock, formatMs } from './format';

type NameOf = (id: string, snapshot?: string) => string;

export function FullscreenPlayer(props: {
  playback: Playback;
  nameOf: NameOf;
  lines: LyricLine[] | null;
  lyricsLoading: boolean;
  onClose: () => void;
}): JSX.Element {
  const { playback, nameOf, lines, lyricsLoading, onClose } = props;
  const { t } = useTranslation();
  const current = playback.current!; // 挂载方保证 current 非空

  const [, forceTick] = useReducer((x: number) => x + 1, 0);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [contentReady, setContentReady] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Keep image decoding, color sampling and the lyrics tree out of the entrance animation.
  useEffect(() => {
    if (contentReady) return;
    const timer = window.setTimeout(() => setContentReady(true), 320);
    return () => window.clearTimeout(timer);
  }, [contentReady]);
  const glow = useCoverColor(contentReady && current.cover_url ? coverSrc(current.cover_url) : undefined, current.track_ref);
  const stageCover = current.cover_url ? (contentReady ? originalCoverSrc(current.cover_url) : coverSrc(current.cover_url)) : undefined;
  const closeTimerRef = useRef<number | null>(null);
  // 移动端视图：封面 ↔ 歌词（点击切换）。everSwitched：首挂载时非活动视图
  // 用静态 view-hidden（0 透明度），避免 view-leave 动画从 1 起步闪一帧
  const [view, setView] = useState<'cover' | 'lyrics'>('cover');
  const [everSwitched, setEverSwitched] = useState(false);
  const switchView = useCallback((v: 'cover' | 'lyrics') => {
    setView(v);
    setEverSwitched(true);
  }, []);
  // chrome 自动隐去：活动后 2.8s 无操作即淡出（光标同隐），任何指针活动唤醒
  const [chromeVisible, setChromeVisible] = useState(true);
  const idleTimerRef = useRef<number | null>(null);
  // 退出动画：先滑下再卸载（280ms 与 CSS transition 对齐）
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closingRef = useRef(false);
  const closePlayer = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => onCloseRef.current(), 280);
  }, []);

  const wake = useCallback(() => {
    setChromeVisible(true);
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setChromeVisible(false), 2800);
  }, []);

  // 进度/歌词高亮 1s 重算；ESC 关闭；打开期间锁定背景滚动；压入返回键栈
  useEffect(() => {
    const id = setInterval(forceTick, 1000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePlayer();
    };
    document.addEventListener('keydown', onKey);
    // 全屏期间锁死背景滚动：body/html 之外，外壳的滚动容器是 <main>（overflow-y-auto），
    // 只锁 body 挡不住触摸链；逐个锁 main 并在清理时恢复
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    const scrollLocks: HTMLElement[] = [];
    for (const m of document.querySelectorAll<HTMLElement>('main')) {
      const cs = getComputedStyle(m);
      if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
        m.style.overflow = 'hidden';
        scrollLocks.push(m);
      }
    }
    pushOverlayCloser('fullscreen-player', closePlayer);
    wake();
    return () => {
      clearInterval(id);
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      for (const m of scrollLocks) m.style.overflow = '';
      removeOverlayCloser('fullscreen-player');
    };
  }, [closePlayer, wake]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  // 起播提前量窗口内推算值为负（本曲还没开始）：钳到 0 再拿去渲染进度条/时间/歌词。
  // 个人暂停时显示本地停住位置（房间仍在播）。
  const personalPaused = renderer.isPersonalPaused;
  const shouldBe = playback.playing
    ? playback.position_ms + (client.clock.serverNow() - playback.updated_at) * playback.rate
    : playback.position_ms;
  const pos = Math.max(
    0,
    Math.min(personalPaused ? audio.currentTime * 1_000 : shouldBe, current.duration_ms),
  );
  const pct = current.duration_ms > 0 ? (pos / current.duration_ms) * 100 : 0;

  const chromeFade = `transition-opacity duration-500 ${
    chromeVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
  }`;

  const lyricsBlock = (align: 'center' | 'left') =>
    !contentReady || lyricsLoading || lines === null ? (
      <p className="pt-24 text-center text-sm text-faint">{t('lyrics.loading')}</p>
    ) : (
      <LyricsPanel
        lines={lines}
        activeIndex={activeLineIndex(lines, pos)}
        emptyText={t('lyrics.unavailable')}
        large
        align={align}
      />
    );

  // Soft radial falloffs are already smooth: no full-viewport blur surfaces or image copies.
  const backdrop = (
    <div aria-hidden="true" className="fullscreen-backdrop" style={{
      backgroundImage: `radial-gradient(ellipse at 22% 30%, ${glow ?? 'var(--fullscreen-ambient-a)'} 0%, transparent 68%), radial-gradient(ellipse at 82% 74%, var(--fullscreen-ambient-b) 0%, transparent 70%)`,
    }} />
  );

  const personalPauseButton = (
    <button
      type="button"
      title={personalPaused ? t('room.personalResume') : t('room.personalPause')}
      onClick={(e) => {
        e.stopPropagation();
        if (personalPaused) renderer.resumePersonal();
        else renderer.pausePersonal();
        forceTick();
      }}
      className={`grid h-12 w-12 place-items-center rounded-full bg-accent text-on-accent transition-transform hover:scale-105 active:scale-100 ${
        personalPaused ? 'opacity-70' : ''
      }`}
    >
      {personalPaused ? (
        <Play className="ml-0.5 h-5 w-5 fill-current" />
      ) : (
        <Pause className="h-5 w-5 fill-current" />
      )}
    </button>
  );

  // Portal keeps the overlay independent of shell transforms. Only the content moves;
  // the ambient layer stays still, and the compositor hint is removed after entry.
  return createPortal(
    <div
      className={`fullscreen-player fixed inset-0 z-50 overflow-hidden ${chromeVisible ? '' : 'cursor-none'}`}
      role="dialog" aria-modal="true" aria-label={t('room.expand')}
      onPointerMove={wake}
    >
      {backdrop}
      <div className={`fullscreen-content h-full w-full ${closing ? 'fullscreen-exit' : !contentReady ? 'fullscreen-enter' : ''}`}>

      <button
        onClick={closePlayer}
        title={t('room.closePlayer')}
        className={`fixed top-[calc(env(safe-area-inset-top)+1.25rem)] right-[calc(env(safe-area-inset-right)+1.5rem)] z-10 grid h-10 w-10 place-items-center rounded-full text-muted after:absolute after:-inset-1 after:content-[''] hover:text-paper ${chromeFade}`}
      >
        <ChevronDown className="h-4.5 w-4.5" />
      </button>

      {/* 移动端：封面/歌词单视图切换（crossfade，点击互切）。 */}
      {!isDesktop && <div className="relative mx-auto h-dvh max-w-md px-6 landscape:max-w-2xl">
        <div
          role="button"
          tabIndex={0}
          aria-label={t('room.showLyrics')}
          aria-hidden={view !== 'cover'}
          onClick={() => switchView('lyrics')}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              switchView('lyrics');
            }
          }}
          className={`absolute inset-0 flex flex-col text-center landscape:flex-row landscape:items-center landscape:gap-8 ${
            view === 'cover' ? 'fs-view-enter' : 'fs-view-leave'
          }`}
        >
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
              {current.cover_url ? (
                <img
                  src={stageCover}
                  alt=""
                  decoding="async"
                  className="aspect-square w-56 rounded-xl object-cover landscape:w-32 sm:w-64 sm:landscape:w-40"
                  style={{ boxShadow: 'var(--cover-shadow)' }}
                />
              ) : (
                <div className="aspect-square w-56 rounded-xl bg-panel-2 landscape:w-32 sm:w-64 sm:landscape:w-40" />
              )}
            </div>
            <div className="px-2 pb-9 landscape:flex-1 landscape:pb-0 landscape:text-left">
              <h2 className="text-2xl leading-tight font-bold tracking-tight">{current.title}</h2>
              <div className="mt-1 text-[13px] text-muted">
                <ArtistLinks
                  artist={current.artist}
                  contributors={current.contributors}
                  trackRef={current.track_ref}
                  onNavigate={onClose}
                />
                {current.album && <span className="text-faint"> · {current.album}</span>}
              </div>
              <div className="mt-5 px-4 landscape:px-0">
                <div className="h-[3px] overflow-hidden rounded bg-white/15">
                  <div
                    className="progress-glide h-full rounded bg-accent"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between font-mono text-[11.5px] text-muted tabular-nums">
                  <span>{formatMs(pos)}</span>
                  <span>{formatMs(current.duration_ms)}</span>
                </div>
                {personalPaused && (
                  <p className="mt-2 text-[11px] text-faint">{t('room.personalPausedHint')}</p>
                )}
              </div>
              <div className="mt-4 flex items-center justify-center gap-4 landscape:justify-start">
                {personalPauseButton}
                <span onClick={(e) => e.stopPropagation()}>
                  <SimilarButton className="grid h-11 w-11 place-items-center rounded-full border border-white/15 text-muted hover:border-white/35 hover:text-paper" />
                </span>
              </div>
            </div>
          </div>

        <div
          role="button"
          tabIndex={0}
          aria-label={t('room.showCover')}
          aria-hidden={view !== 'lyrics'}
          onClick={() => switchView('cover')}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              switchView('cover');
            }
          }}
          className={`absolute inset-0 overflow-hidden ${
            view === 'lyrics' ? 'fs-view-enter' : everSwitched ? 'fs-view-leave' : 'fs-view-hidden'
          }`}
        >
          {view === 'lyrics' || everSwitched ? <div className="h-full px-2 py-12">{lyricsBlock('center')}</div> : null}
        </div>
      </div>}

      {/* 桌面舞台：左封面/信息（按视口高度定尺寸，静止陈列），右歌词占满余宽 */}
      {isDesktop && <div className="relative flex h-dvh items-center gap-[5vw] px-[7vw]">
        <div className="w-[min(30vw,58vh)] flex-none">
          {current.cover_url ? (
            <img
              src={stageCover}
              alt=""
              decoding="async"
              className="aspect-square w-full rounded-lg object-cover"
              style={{ boxShadow: 'var(--cover-shadow)' }}
            />
          ) : (
            <div className="aspect-square w-full rounded-lg bg-panel-2" />
          )}

          <h2 className="mt-8 text-[clamp(1.9rem,3.2vw,3.25rem)] leading-[1.02] font-bold tracking-[-0.03em] text-paper">
            {current.title}
          </h2>
          <div className="mt-2.5 text-lg text-muted">
            <ArtistLinks
              artist={current.artist}
              contributors={current.contributors}
              trackRef={current.track_ref}
              onNavigate={onClose}
            />
            {current.album && <span className="text-faint"> · {current.album}</span>}
          </div>
          <div className={`mt-2 text-xs text-faint ${chromeFade}`}>
            {t('room.requestedBy', {
              name: nameOf(current.requested_by, current.requester_name),
              time: formatClock(current.added_at),
            })}
          </div>
          {personalPaused && (
            <p className={`mt-3 text-[11px] text-faint ${chromeFade}`}>
              {t('room.personalPausedHint')}
            </p>
          )}
        </div>

        {/* 右区：歌词（左对齐大字级，占满余宽消灭中部留白） */}
        <div className="h-[86vh] min-w-0 flex-1">{lyricsBlock('left')}</div>
      </div>}

      {/* 底部通栏发丝进度线：贯穿视口，白色半透明、不随主题色、不挂数显（桌面） */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 hidden lg:block">
        <div className="h-[2px] w-full bg-white/10">
          <div className="progress-glide h-full bg-white/70" style={{ width: `${pct}%` }} />
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}
