/**
 * 封面取色探针：显示图一律 no-cors（跟随 302，永不因 CORS/ACAO 抖动失败），
 * 但跨源 no-cors 图会污染 canvas、无法读像素。探针另起一个 CORS 模式请求同一
 * 代理 URL：服务端对带 Origin 的请求不 302、流式回源 + ACAO（见服务端
 * proxyCover），canvas 可读。仅 hero 封面（艺人头像/歌单封面）使用——每页多
 * 一次缩略图请求，浏览器按 CORS 分区缓存（max-age 1 月），非首次访问不重复。
 */
import { useEffect, useState } from 'react';
import { extractGlowColors } from './glow';

export function useCoverColor(src: string | undefined): string | null {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    setColor(null);
    if (!src) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (dead) return;
      setColor(extractGlowColors(img)?.[0] ?? null);
    };
    img.onerror = () => {
      if (dead) return;
      setColor(null);
    };
    img.src = src;
    return () => {
      dead = true;
    };
  }, [src]);

  return color;
}
