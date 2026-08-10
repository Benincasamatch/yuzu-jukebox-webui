import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Heart, X } from 'lucide-react';
import { api } from '../../app/session';
import { coverSrc } from '../cover';
import { useProviders, useRoomState } from '../hooks';
import { useShell } from '../shellContext';
import { useToast } from '../toast';

export function NowPlayingPanel() {
  const { t } = useTranslation();
  const state = useRoomState();
  const providers = useProviders();
  const { nameOf, setNowPlayingOpen, setQueueOpen } = useShell();
  const { show, showError } = useToast();
  const [likedRefs, setLikedRefs] = useState<Set<string>>(() => new Set());

  const current = state.playback.current;
  const next = state.queue[0];
  const currentRef = current?.track_ref;
  const accountTarget = (() => {
    if (!currentRef) return null;
    const separator = currentRef.indexOf(':');
    if (separator <= 0) return null;
    const providerId = currentRef.slice(0, separator);
    const provider = providers?.find((candidate) => candidate.id === providerId);
    if (!provider?.owned) return null;
    const writeCapabilities = provider.capabilities?.account_write ?? [];
    return {
      providerId,
      trackId: currentRef.slice(separator + 1),
      canLike: writeCapabilities.includes('like'),
      canLikeCheck: writeCapabilities.includes('like_check'),
    };
  })();
  const liked = currentRef !== undefined && likedRefs.has(currentRef);

  useEffect(() => {
    if (!currentRef || !accountTarget?.canLikeCheck) return;
    const ref = currentRef;
    let cancelled = false;
    void api
      .likeCheck(accountTarget.providerId, accountTarget.trackId)
      .then((serverLiked) => {
        if (cancelled) return;
        setLikedRefs((refs) => {
          const nextRefs = new Set(refs);
          if (serverLiked) nextRefs.add(ref);
          else nextRefs.delete(ref);
          return nextRefs;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accountTarget?.canLikeCheck, accountTarget?.providerId, accountTarget?.trackId, currentRef]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-none items-center gap-3 px-4 py-4">
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-paper">
          {t('np.title')}
        </p>
        <button
          type="button"
          title={t('np.close')}
          onClick={() => setNowPlayingOpen(false)}
          className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted transition hover:bg-[var(--hover)] hover:text-paper"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {current ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
          {current.cover_url ? (
            <img
              src={coverSrc(current.cover_url)}
              alt=""
              className="aspect-square w-full rounded-md object-cover"
            />
          ) : (
            <div className="aspect-square w-full rounded-md bg-panel-2" />
          )}

          <section className="mt-5 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold text-paper">{current.title}</h2>
              <p className="truncate text-[14px] text-muted">{current.artist}</p>
            </div>
            {current.source_url?.startsWith('http') && (
              <a
                href={current.source_url}
                target="_blank"
                rel="noreferrer"
                title={t('np.openSource')}
                aria-label={t('np.openSource')}
                className="grid h-9 w-9 flex-none place-items-center rounded-full text-muted transition hover:bg-[var(--hover)] hover:text-paper"
              >
                <ExternalLink className="h-5 w-5" />
              </a>
            )}
            {accountTarget?.canLike && (
              <button
                type="button"
                title={liked ? t('like.liked') : t('like.like')}
                disabled={liked}
                onClick={() => {
                  void api
                    .likeTrack(accountTarget.providerId, accountTarget.trackId)
                    .then(() => {
                      setLikedRefs((refs) => new Set(refs).add(current.track_ref));
                      show(t('like.likedToast', { title: current.title }));
                    })
                    .catch(showError);
                }}
                className={`grid h-9 w-9 flex-none place-items-center rounded-full transition hover:bg-[var(--hover)] disabled:opacity-100 ${
                  liked ? 'text-accent' : 'text-muted hover:text-paper'
                }`}
              >
                <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
              </button>
            )}
          </section>

          <div className="mt-5 flex items-center justify-between gap-3 text-[13px]">
            <span className="text-muted">{t('np.requester')}</span>
            <span className="min-w-0 truncate font-semibold text-paper">
              {nameOf(current.requested_by, current.requester_name)}
            </span>
          </div>

          {next && (
            <section className="mt-6">
              <h3 className="mb-2 text-[15px] font-semibold text-paper">{t('np.next')}</h3>
              <button
                type="button"
                title={t('np.openQueue')}
                onClick={() => setQueueOpen(true)}
                className="flex w-full items-center gap-3 rounded-md bg-panel-2 p-3 text-left transition hover:bg-[var(--hover)]"
              >
                {next.cover_url ? (
                  <img
                    src={coverSrc(next.cover_url)}
                    alt=""
                    className="h-12 w-12 flex-none rounded-md object-cover"
                  />
                ) : (
                  <span className="h-12 w-12 flex-none rounded-md bg-panel" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-paper">{next.title}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {t('np.requestedBy', { name: nameOf(next.requested_by, next.requester_name) })}
                  </span>
                </span>
              </button>
            </section>
          )}

          <section className="mt-6 rounded-md bg-panel-2 p-4">
            <h3 className="text-[13px] font-semibold text-paper">{t('np.aboutArtist')}</h3>
            <p className="mt-4 truncate text-base font-bold text-paper">{current.artist}</p>
            <p className="mt-2 text-[13px] leading-5 text-muted">{t('np.artistPlaceholder')}</p>
          </section>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center px-6 pb-16 text-center">
          <p className="text-[14px] leading-6 text-muted">{t('np.empty')}</p>
        </div>
      )}
    </div>
  );
}
