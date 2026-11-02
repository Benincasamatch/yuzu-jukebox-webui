/**
 * 播放器单例：全应用共享一个 <audio> 与一个渲染内核。
 * 必须在组合根持有——RoomView 每次挂载新建实例会导致旧实例
 * 收不到停止信号、重新进房时双重播放。
 */
import { Capacitor } from '@capacitor/core';
import { loadWebFollow, saveWebFollow } from './webFollow';
import { AudioRenderer } from '../player/renderer';
import type { Playback } from '../protocol/types';
import { client } from './session';

/** 空闲播放态：离房/停止时渲染它，渲染内核会 pause 并清空 src */
export const IDLE_PLAYBACK: Playback = {
  current: null,
  position_ms: 0,
  updated_at: 0,
  playing: false,
  rate: 1,
};

export const audio = new Audio();
export const isWebPlayback = !Capacitor.isNativePlatform();
const followInitially = isWebPlayback ? loadWebFollow() : true;
const FOLLOW_EVENT = 'yuzu-web-follow-change';
if (isWebPlayback) saveWebFollow(followInitially);
export const renderer = new AudioRenderer(audio, client.clock, undefined, {
  initiallyPaused: !followInitially,
  preserveAcrossRooms: isWebPlayback,
  onChange: (paused) => {
    if (!isWebPlayback) return;
    saveWebFollow(!paused);
    window.dispatchEvent(new Event(FOLLOW_EVENT));
  },
});

export function subscribeWebFollow(callback: () => void): () => void {
  window.addEventListener(FOLLOW_EVENT, callback);
  return () => window.removeEventListener(FOLLOW_EVENT, callback);
}

export function webFollowEnabled(): boolean {
  return !renderer.isPersonalPaused;
}

export function setWebFollow(enabled: boolean): void {
  if (enabled) renderer.resumePersonal();
  else renderer.pausePersonal();
}
