/**
 * 封面卡（首页 shelf 横排行与 /shelf 全览页共用）：默认无底色，
 * hover 整卡亮起（Spotify 同款）+ 封面浮现 inset 描边与播放大钮。
 * 整卡点击 = 入队。宽度由外层容器控制（行内 w-[180px]，网格内自适应）。
 */
import { type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';
import { roomStore } from '../app/session';
import { coverSrc } from './cover';
import { CoverThumb } from './CoverThumb';
import { useRoomState } from './hooks';
import { useToast } from './toast';
import { useShell } from './shellContext';

export function ActivityCard({
  trackRef,
  title,
  meta,
  className,
}: {
  trackRef: string;
  title: string;
  meta: string;
  /** 外层宽度控制：shelf 横排行传 w-[180px] flex-none；全览页网格省略（justify-self 拉伸） */
  className?: string;
}): JSX.Element {
  const { t } = useTranslation();
  const { setRoomsOpen } = useShell();
  const { show, showError } = useToast();
  const state = useRoomState();

  return (
    <button
      type="button"
      title={t('search.add')}
      onClick={() => {
        if (!state.roomId) {
          show(t('home.needRoom'));
          setRoomsOpen(true);
          return;
        }
        void roomStore
          .addQueue([trackRef])
          .then(() => show(t('room.addedToast', { title })))
          .catch(showError);
      }}
      className={`group block rounded-lg p-3 text-left transition-colors hover:bg-panel-2 ${className ?? 'w-full'}`}
    >
      <div className="relative aspect-square w-full rounded-md transition-shadow group-hover:shadow-[inset_0_0_0_1px_var(--rail)]">
        <CoverThumb
          src={coverSrc(`/api/v1/cover/${encodeURIComponent(trackRef)}`)}
          alt={title}
          className="h-full w-full rounded-md"
        />
        <span
          aria-hidden="true"
          className="absolute right-2 bottom-2 grid h-12 w-12 translate-y-2 place-items-center rounded-full bg-accent text-on-accent opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
        >
          <Play className="h-5 w-5 fill-current" />
        </span>
      </div>
      <div className="mt-3 truncate text-[15px] font-semibold text-paper">{title}</div>
      <div className="mt-1 line-clamp-2 text-[13px] text-muted">{meta}</div>
    </button>
  );
}
