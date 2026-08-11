/**
 * 封面取色探针 + 本地颜色缓存：显示图 no-cors（跟随 302，永不因 CORS/ACAO 抖动
 * 失败）→ 画布必被污染、不能直接取色；探针另起 CORS 请求同一代理 URL，服务端对
 * 带 Origin 的请求流式回源 + ACAO（见服务端 proxyCover），canvas 可读。
 *
 * 取出的主色按**稳定键**（provider:entity / 歌单 id，而非可能随上游 CDN 主机轮换
 * 的 URL）存 localStorage：挂载即同步返回缓存色（启动零等待、零网络），超过 TTL
 * 才在后台探针刷新。ncm 常轮换 CDN 主机（同一头像 p3/p4 变来变去），用 URL 作键
 * 会让缓存永远失效——稳定键免疫这一点。
 */
import { useEffect, useState } from 'react';
import { extractGlowColors } from './glow';

const COLOR_CACHE_KEY = 'yuzu-cover-colors';
/** 7 天自愈：封面换图后最迟一周刷新 */
const COLOR_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** 上限淘汰最旧，防 localStorage 无限膨胀 */
const COLOR_CACHE_MAX = 200;

interface ColorEntry {
  color: string;
  at: number;
}

function readCache(): Record<string, ColorEntry> {
  try {
    const raw = localStorage.getItem(COLOR_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ColorEntry>) : {};
  } catch {
    return {};
  }
}

function writeCache(map: Record<string, ColorEntry>): void {
  try {
    localStorage.setItem(COLOR_CACHE_KEY, JSON.stringify(map));
  } catch {
    // 配额满等：静默失败，下次重取
  }
}

export function useCoverColor(src: string | undefined, key?: string): string | null {
  const [color, setColor] = useState<string | null>(() => {
    if (!src && !key) return null;
    const cacheKey = key ?? src!;
    return readCache()[cacheKey]?.color ?? null;
  });

  useEffect(() => {
    if (!src) return;
    const cacheKey = key ?? src;
    let dead = false;

    const cached = readCache()[cacheKey];
    if (cached) {
      // 有任何缓存（含过期）先立即展示，渐变不等网络；新鲜则直接收工
      setColor(cached.color);
      if (Date.now() - cached.at < COLOR_TTL_MS) return;
    } else {
      setColor(null);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (dead) return;
      const found = extractGlowColors(img)?.[0];
      if (found) {
        setColor(found);
        const map = readCache();
        map[cacheKey] = { color: found, at: Date.now() };
        const entries = Object.entries(map).sort((left, right) => right[1].at - left[1].at);
        for (const [staleKey] of entries.slice(COLOR_CACHE_MAX)) delete map[staleKey];
        writeCache(map);
      } else {
        // 纯色封面等取不到：回退面板色，不缓存（避免空转）
        setColor(null);
      }
    };
    // 刷新失败：保留既有缓存色（过期色好过回退面板色）
    img.onerror = () => {};
    img.src = src;

    return () => {
      dead = true;
    };
  }, [src, key]);

  return color;
}
