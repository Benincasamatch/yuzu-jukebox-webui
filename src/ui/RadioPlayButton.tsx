/**
 * 「以电台播放」按钮（集合页/歌单详情页共用）：对任意电台源规格发起
 * radio.play，启动时选择模式（顺序/随机/单次）——模式是启动时的决定，
 * 不设全局开关。未入房引导选房；无电台权限提示。菜单 portal 到 body
 * （fixed 层不被祖先 transform 劫持）。
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Radio } from 'lucide-react';
import { roomStore } from '../app/session';
import { useRoomState } from './hooks';
import { useShell } from './shellContext';
import { isVisibleRadioSource } from './radioSources';
import { useToast } from './toast';

const MODES = [
  { key: 'radio.modeSequential', shuffle: false, once: false },
  { key: 'radio.modeShuffle', shuffle: true, once: false },
  { key: 'radio.modeOnce', shuffle: false, once: true },
] as const;

export function RadioPlayButton({
  source,
  className,
}: {
  /** 完整电台源规格（如 ncm:newsong、qq:top:26、playlist:pl_xxx） */
  source: string;
  className?: string;
}): JSX.Element | null {
  const { t } = useTranslation();
  const state = useRoomState();
  const { canRadio, setRoomsOpen } = useShell();
  const { show, showError } = useToast();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!menu) return;
    // 注意：不能在 mousedown 时无脑关闭——点击菜单项时 mousedown 先到，
    // 若立即 setMenu(null) 卸载菜单，后续 click 不会再派发到菜单项，
    // play() 永远不执行（曾导致「以电台播放」菜单点了没反应）。
    // 只关闭按钮与菜单之外的 mousedown；菜单内让 click 走完再关。
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  if (!isVisibleRadioSource(source)) return null;

  const open = () => {
    if (!state.roomId) {
      show(t('home.needRoom'));
      setRoomsOpen(true);
      return;
    }
    if (!canRadio) {
      show(t('home.radioNeedControl'));
      return;
    }
    if (menu) {
      setMenu(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenu({ x: rect.left, y: rect.bottom + 6 });
  };

  const play = (shuffle: boolean, once: boolean) => {
    setMenu(null);
    if (busy) return;
    setBusy(true);
    void roomStore
      .radioPlay(source, shuffle, once)
      .then(() => show(t('roomAdmin.radioStarted')))
      .catch(showError)
      .finally(() => setBusy(false));
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={busy}
        onClick={open}
        aria-label={t('radio.playAsRadio')}
        title={t('radio.playAsRadio')}
        className={`inline-flex items-center gap-1.5 rounded-full border border-hairline px-3.5 py-1.5 text-[13px] font-medium text-muted transition hover:border-accent hover:text-paper disabled:opacity-40 max-md:h-12 max-md:w-12 max-md:justify-center max-md:border-transparent max-md:p-0 max-md:hover:bg-[var(--hover)] ${className ?? ''}`}
      >
        <Radio className="h-4 w-4 max-md:h-6 max-md:w-6" aria-hidden="true" />
        <span className="max-md:hidden">
          {busy ? t('roomAdmin.radioStarting') : t('radio.playAsRadio')}
        </span>
        <ChevronDown className="h-3.5 w-3.5 max-md:hidden" aria-hidden="true" />
      </button>

      {menu &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="menu-content fixed z-50 w-44 rounded-lg border border-hairline bg-panel-2 p-1.5"
            style={{ left: menu.x, top: menu.y }}
          >
            {MODES.map((mode) => (
              <button
                key={mode.key}
                type="button"
                role="menuitem"
                onClick={() => play(mode.shuffle, mode.once)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-muted outline-none transition hover:bg-[var(--hover)] hover:text-paper"
              >
                {t(mode.key)}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
