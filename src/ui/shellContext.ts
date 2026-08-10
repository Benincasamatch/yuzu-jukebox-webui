import { createContext, useContext } from 'react';
import { YuzuError } from '../protocol/types';

/** 桌面/移动两壳共享的 Shell 上下文：房间动作 + 播放授权。 */
export type JoinResult = 'joined' | 'need_credential' | 'failed';

/** 右侧面板槽位的内容种类（Spotify 的 Queue/Connect/Now Playing 共用同一槽位，互斥）。 */
export type RightPanelKind = 'nowPlaying' | 'queue' | 'rooms';

export interface ShellValue {
  canControl: boolean;
  /** 电台启停授权（policy.radio_control 推导，spec §4.7）；独立于 canControl */
  canRadio: boolean;
  /** requested_by 身份 ID → 显示名（条目快照优先，听众表次之，回退 ID） */
  nameOf: (id: string, snapshot?: string) => string;
  joinRoom: (roomId: string, password?: string) => Promise<JoinResult>;
  leaveRoom: () => Promise<void>;
  /**
   * 右面板槽位（桌面壳）：Now Playing 是常驻默认态，queue/rooms 打开时原位
   * 叠加，关闭即回到 Now Playing。移动壳不渲染槽位，但 queue/rooms 派生态
   * 驱动抽屉与房间弹层，语义一致。
   */
  rightPanel: RightPanelKind;
  setRightPanel: (kind: RightPanelKind) => void;
  /** Now Playing 折叠为右侧细轨（仅 kind === 'nowPlaying' 时有意义；悬停可预览） */
  nowPlayingCollapsed: boolean;
  /** 派生：rightPanel === 'queue'；关闭回到 Now Playing */
  queueOpen: boolean;
  setQueueOpen: (open: boolean) => void;
  /** 派生：rightPanel === 'rooms'；关闭回到 Now Playing */
  roomsOpen: boolean;
  setRoomsOpen: (open: boolean) => void;
  /** 派生：rightPanel === 'nowPlaying' 且未折叠；置 false = 折叠成细轨 */
  nowPlayingOpen: boolean;
  setNowPlayingOpen: (open: boolean) => void;
}

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const value = useContext(ShellContext);
  if (!value) throw new YuzuError('internal', 'useShell outside shell');
  return value;
}

/** 顶栏搜索 provider 的本机记忆：顶栏下拉写入，搜索页缺省读取。 */
export const SEARCH_PROVIDER_KEY = 'yuzu-search-provider';
