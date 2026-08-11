/**
 * 艺人名拆分与跳转链接。
 *
 * 曲目元数据里的 artist 只是拼接字符串（「塞壬唱片-MSR/F.L.O.A.T (白羽）/张晶」），
 * 整串拿去导航/解析既点不进单个艺人、也常解析不到实体。拆分依据优先级：
 * 1. `contributors`（服务端下发的结构化名单，ncm/qq 角色 artist、bili/local 角色
 *    uploader）——精确，名字本身含分隔符的艺人（如 AC/DC）不会被误切；
 * 2. 分隔符拆串（/ ／ 、 ， , ； ;）——contributors 缺省（老服务端、历史/热榜
 *    聚合、歌单条目）时的兜底。
 * 渲染保留原字符串的分隔符与顺序，只把艺人名变成链接。
 */
import type { JSX, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Contributor } from '../protocol/types';

/** 多艺人分隔符（含两侧空白）；连字符/点/& 不切（常为名字一部分）。 */
const SEPARATOR = /(\s*[/／、，,；;]\s*)/;

/** contributors 中的艺人名（保序去重去空白）；无可用项返回空数组。
 *  可跳转角色：ncm/qq=artist；bili/local=uploader。 */
function contributorNames(contributors?: Contributor[]): string[] {
  const names: string[] = [];
  for (const contributor of contributors ?? []) {
    if (contributor.role !== 'artist' && contributor.role !== 'uploader') continue;
    const name = contributor.name.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/** 艺人名列表：contributors 精确优先，缺省回退分隔符拆串（去空白、去空项、保序去重）。 */
export function splitArtistNames(artist: string, contributors?: Contributor[]): string[] {
  const named = contributorNames(contributors);
  if (named.length > 0) return named;
  const names: string[] = [];
  for (const token of artist.split(SEPARATOR)) {
    const name = token.trim();
    if (!name || SEPARATOR.test(token) || names.includes(name)) continue;
    names.push(name);
  }
  return names;
}

/** 渲染分词：text 原文片段；name 非空 = 该片段是可跳转的艺人名。 */
export interface ArtistToken {
  text: string;
  name?: string;
}

/**
 * 渲染分词：优先按 contributors 名在原文中依序定位（保留原分隔符、未命中部分
 * 原样输出）；一个都没命中（名串与 contributors 对不上）回退分隔符拆分。
 */
export function tokenizeArtists(artist: string, contributors?: Contributor[]): ArtistToken[] {
  const named = contributorNames(contributors);
  if (named.length > 0) {
    const tokens: ArtistToken[] = [];
    let rest = artist;
    let matched = 0;
    for (const name of named) {
      const at = rest.indexOf(name);
      if (at < 0) continue;
      if (at > 0) tokens.push({ text: rest.slice(0, at) });
      tokens.push({ text: rest.slice(at, at + name.length), name });
      rest = rest.slice(at + name.length);
      matched += 1;
    }
    if (matched > 0) {
      if (rest) tokens.push({ text: rest });
      return tokens;
    }
  }
  return artist.split(SEPARATOR).map((text, index) => {
    const name = index % 2 === 0 ? text.trim() : '';
    return { text, name: name || undefined };
  });
}

/** 艺人页链接：trackRef 作解析锚定（服务端优先用该曲目 provider 解析，提高命中率）。 */
export function artistHref(name: string, trackRef?: string): string {
  const base = `/artist/${encodeURIComponent(name)}`;
  return trackRef ? `${base}?track=${encodeURIComponent(trackRef)}` : base;
}

/**
 * 艺人名链接组：保留原字符串的分隔符与顺序，仅把每个艺人名渲染为跳转链接。
 * 链接点击 stopPropagation——本组件常嵌在「点行=入队」的可点击行内。
 * onNavigate 供覆盖层场景（FullscreenPlayer）在跳转前收起自身。
 */
export function ArtistLinks(props: {
  artist: string;
  contributors?: Contributor[];
  trackRef?: string;
  className?: string;
  linkClassName?: string;
  onNavigate?: () => void;
}): JSX.Element | null {
  const { artist, contributors, trackRef, className, linkClassName, onNavigate } = props;
  if (!artist.trim()) return null;
  const tokens = tokenizeArtists(artist, contributors);
  const onClick = (event: MouseEvent) => {
    event.stopPropagation();
    onNavigate?.();
  };
  return (
    <span className={className}>
      {tokens.map((token, index) =>
        token.name ? (
          <Link
            key={`${token.name}-${index}`}
            to={artistHref(token.name, trackRef)}
            onClick={onClick}
            className={`hover:underline ${linkClassName ?? ''}`}
          >
            {token.text}
          </Link>
        ) : (
          token.text
        ),
      )}
    </span>
  );
}
