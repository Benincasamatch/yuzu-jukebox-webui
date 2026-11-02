/**
 * 房间切换器（桌面播放栏）：Spotify Connect 设备按钮的对应物。
 * 点击开/关右面板槽位的 rooms 内容（房间列表 + controller 控制区），
 * 内容与移动端房间弹层共用 RoomPickerContent。
 */
import { type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { MonitorSpeaker } from 'lucide-react';
import { useRooms, useRoomState } from '../hooks';
import { useShell } from '../shellContext';

export function RoomSwitcher(): JSX.Element {
  const { t } = useTranslation();
  const state = useRoomState();
  const { rightPanel, setRightPanel } = useShell();
  const rooms = useRooms();
  const open = rightPanel === 'rooms';

  const currentId = state.roomId;
  const currentRoom = (rooms ?? []).find((room) => room.id === currentId);

  return (
    <button
      type="button"
      title={t('shell.roomSwitch')}
      aria-pressed={open}
      onClick={() => setRightPanel(open ? 'nowPlaying' : 'rooms')}
      className={`flex min-w-0 max-w-60 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-[var(--hover)] ${
        open ? 'text-accent' : 'text-muted hover:text-paper'
      }`}
    >
      <MonitorSpeaker className="h-4 w-4 flex-none" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          {currentId ? (currentRoom?.name ?? currentId) : t('shell.roomSwitch')}
        </span>
        {currentId && (
          <span className="block font-mono text-[10.5px] leading-tight text-faint">
            {t('room.listenerCount', { count: state.listeners.length })}
          </span>
        )}
      </span>
    </button>
  );
}
