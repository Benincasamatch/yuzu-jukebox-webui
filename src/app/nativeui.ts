/**
 * 系统栏（状态栏/导航栏）图标明暗同步：Android edge-to-edge（targetSdk 35+ 强制）
 * 下状态栏透明、Web 内容画到其下，图标对比度由 appearanceLightStatusBars 决定。
 * 基座 DayNight 主题只跟随系统——App 深色 + 系统浅色时深色图标压在深色内容上
 * 不可见，故由 Web 主题轴（app/theme.ts applyScheme）驱动原生侧。
 *
 * 刻意不 import nativemedia（isNativeApp）：theme 是底层模块，nativemedia 经
 * session 装配会拉回循环依赖；平台探测直接用 Capacitor。
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

interface YuzuSystemBarsHandle {
  setScheme(options: { dark: boolean }): Promise<void>;
}

const handle = Capacitor.isNativePlatform()
  ? registerPlugin<YuzuSystemBarsHandle>('YuzuSystemBars')
  : null;

/** 浏览器为空转；原生侧失败静默（系统栏对比度退化为 DayNight 旧行为）。 */
export function syncSystemBars(scheme: 'dark' | 'light'): void {
  if (!handle) return;
  void handle.setScheme({ dark: scheme === 'dark' }).catch(() => {});
}
