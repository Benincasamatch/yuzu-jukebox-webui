import { useEffect, useRef, useState, type JSX } from 'react';
import type { LyricLine } from '../player/lyrics';

/**
 * 排版规整：弯引号（‘’“”）与全角引号（＇＂）在 CJK 字体回退里按全角
 * 宽度渲染，一个符号吃掉半个字的空白（英文歌词里的 don't 变成 don' t）。
 * 规整为半角 ASCII 引号；仅影响渲染，不改原始 LRC 数据。
 */
const normalizeGlyphs = (text: string): string =>
  text.replace(/[‘’＇]/g, "'").replace(/[“”＂]/g, '"');

/**
 * 歌词面板：无框设计——舞台自身已是容器，面板透明嵌入。
 * 上下渐隐遮罩引导视线到当前行；active 行大字点亮，其余行「次大」同字级、
 * 仅靠明度做距离衰减（无模糊、无字号跳水）。
 * 手动滚动即接管焦点：暂停自动跟踪，期间 active 行白度拉平与邻行一致
 * （零重排的状态信号），滚动停止 5s 后自动恢复跟踪并平滑滚回当前行。
 * 高度由父容器决定（h-full）。
 */
export function LyricsPanel(props: {
  lines: LyricLine[];
  activeIndex: number;
  emptyText: string;
  /** 全屏播放页用大字级；舞台小预览默认小字级 */
  large?: boolean;
  /** 大字级对齐：全屏舞台左对齐（Apple Music 式），默认居中 */
  align?: 'center' | 'left';
}): JSX.Element {
  const { lines, activeIndex, emptyText, large = false, align = 'center' } = props;
  const lineRefs = useRef<Array<HTMLLIElement | null>>([]);
  // 跟踪态：false = 用户正在手动浏览（滚动停止 5s 后自动恢复）
  const [following, setFollowing] = useState(true);
  const holdTimerRef = useRef<number | null>(null);

  // wheel/touchmove 只由真实用户滚动触发；scrollIntoView 的程序化滚动不会走到这里
  const noteUserScroll = () => {
    setFollowing(false);
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => setFollowing(true), 5000);
  };

  useEffect(
    () => () => {
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!following) return;
    const activeLine = lineRefs.current[activeIndex];
    if (!activeLine) {
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activeLine.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'center',
    });
  }, [activeIndex, following]);

  if (lines.length === 0) {
    return (
      <div className="grid h-full place-items-center text-center text-sm text-faint">
        {emptyText}
      </div>
    );
  }

  const browsing = !following;

  return (
    <ol
      onWheel={noteUserScroll}
      onTouchMove={noteUserScroll}
      className={`no-scrollbar h-full overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)] ${
        align === 'left' ? 'text-left' : 'text-center'
      }`}
    >
      {/* 顶部留白，让首行能滚到视口中部 */}
      <li aria-hidden className="h-[38%]" />
      {lines.map((line, index) => {
        const active = index === activeIndex;
        const distance = Math.abs(index - activeIndex);
        // 非激活行同字级（「次大」），仅明度随距离衰减；浏览态下 active 行
        // 白度拉平——尺寸与字重不动，避免滚动中重排
        const lineClass = active
          ? `font-bold ${
              large
                ? 'text-[clamp(1.8rem,2.6vw,2.6rem)] leading-[1.25]'
                : 'font-display text-lg leading-relaxed'
            } ${browsing ? 'text-white/60' : large ? 'text-paper' : 'text-paper'}`
          : large
            ? `text-[clamp(1.1rem,1.6vw,1.5rem)] leading-relaxed ${
                distance === 1 ? 'text-white/60' : distance === 2 ? 'text-white/45' : 'text-white/30'
              }`
            : `text-[13px] leading-relaxed ${distance === 1 ? 'text-muted' : 'text-faint'}`;
        const translationClass = active
          ? `${
              large
                ? 'mt-1.5 text-[clamp(1.05rem,1.5vw,1.35rem)] leading-relaxed'
                : 'mt-0.5 text-[13px] leading-relaxed'
            } ${browsing ? 'text-white/45' : 'text-muted'}`
          : large
            ? `mt-1 text-[clamp(0.9rem,1.2vw,1.1rem)] leading-relaxed ${
                distance === 1 ? 'text-white/45' : distance === 2 ? 'text-white/32' : 'text-white/22'
              }`
            : 'mt-0.5 text-xs leading-relaxed text-faint';
        return (
          <li
            key={`${line.timeMs}:${index}`}
            ref={(element) => {
              lineRefs.current[index] = element;
            }}
            aria-current={active ? 'true' : undefined}
            className={`py-2.5 transition-colors duration-[var(--speed)] ${
              align === 'left' ? 'pr-6 pl-0' : 'px-6'
            }`}
          >
            <p className={lineClass}>{normalizeGlyphs(line.text)}</p>
            {line.translation !== undefined && (
              <p className={translationClass}>{normalizeGlyphs(line.translation)}</p>
            )}
          </li>
        );
      })}
      {/* 底部留白，让末行能滚到视口中部 */}
      <li aria-hidden className="h-[38%]" />
    </ol>
  );
}
