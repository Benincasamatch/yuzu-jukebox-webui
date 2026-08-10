import { httpBase } from '../config';

/**
 * 封面 src 解析：服务端序列化层保证 cover_url 一律为代理路径
 * （track → `/api/v1/cover/{ref}`，实体/歌单 → `/api/v1/cover/ext/{token}`，
 * 自建歌单 → `/api/v1/cover/playlist/{id}`，spec §4.1 / 6.2.1）。
 * 根相对路径需前缀 httpBase：跨源部署（config.js server 非空）时
 * API 基址 ≠ 页面源，裸路径直接喂 <img> 会打错源。
 */
export function coverSrc(url: string): string {
  return url.startsWith('/') ? `${httpBase}${url}` : url;
}

/**
 * 原图质量封面：服务端封面端点默认回源缩略图（CoverThumbnailer），
 * ?size=original 跳过变换（proxyCover 的逃生门）。全屏展示等大幅面场景用。
 */
export function originalCoverSrc(url: string): string {
  const src = coverSrc(url);
  return `${src}${src.includes('?') ? '&' : '?'}size=original`;
}
