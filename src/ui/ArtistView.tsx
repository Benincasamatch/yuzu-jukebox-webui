import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import { useParams } from 'react-router-dom';
import type { ArtistProfile } from '../api/types';
import { api } from '../app/session';
import { coverSrc } from './cover';
import { formatDateTime } from './format';
import { TrackList, useEnqueue, type TrackListTrack } from './TrackList';
import { useToast } from './toast';

export default function ArtistView(): JSX.Element {
  const { t } = useTranslation();
  const { name: rawName } = useParams();
  const name = decodeURIComponent(rawName ?? '');
  const enqueue = useEnqueue();
  const { showError } = useToast();
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    let dead = false;
    setProfile(null);
    setFailed(false);
    setAvatarFailed(false);
    api
      .artistProfile(name)
      .then((result) => {
        if (!dead) setProfile(result);
      })
      .catch((err: unknown) => {
        if (dead) return;
        setFailed(true);
        showError(err);
      });
    return () => {
      dead = true;
    };
  }, [name, reload, showError]);

  if (profile === null) {
    return (
      <div className="view-enter px-4 pt-4 pb-10 md:px-8 md:pt-6">
        {failed ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted">{t('artistPage.loadFailed')}</p>
            <button
              type="button"
              onClick={() => setReload((value) => value + 1)}
              className="mt-4 rounded-full bg-panel-2 px-4 py-2 text-[13px] font-semibold text-paper transition hover:bg-[var(--hover)]"
            >
              {t('artistPage.retry')}
            </button>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-muted">{t('common.loading')}</p>
        )}
      </div>
    );
  }

  // 艺人档案端点不含时长：不传 duration_ms，TrackList 整列隐藏（不渲染伪造的 0:00）
  const tracks: TrackListTrack[] = profile.top_tracks.map((track) => ({
    track_ref: track.track_ref,
    title: track.title,
    artist: track.artist,
    cover_url: track.cover_url,
  }));

  return (
    <div className="view-enter px-4 pt-4 pb-10 md:px-8 md:pt-6">
      <section>
        <div className="mb-8 flex items-start gap-5">
          {profile.avatar_url && !avatarFailed ? (
            <img
              src={coverSrc(profile.avatar_url)}
              alt={t('artistPage.avatarAlt', { name: profile.name })}
              onError={() => setAvatarFailed(true)}
              className="h-[92px] w-[92px] flex-none rounded-full object-cover"
              style={{ boxShadow: 'var(--cover-shadow)' }}
            />
          ) : (
            <div className="grid h-[92px] w-[92px] flex-none place-items-center rounded-full bg-panel-2 text-faint">
              <User className="h-9 w-9" aria-hidden="true" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-muted">{t('artistPage.eyebrow')}</div>
            <h1 className="mt-1 line-clamp-2 text-4xl leading-none font-bold tracking-tight text-paper md:text-5xl">
              {profile.name}
            </h1>
            <p className="mt-2 text-[13px] text-muted">
              {profile.last_played_at > 0
                ? t('artistPage.stats', {
                    count: profile.play_count,
                    time: formatDateTime(profile.last_played_at),
                  })
                : t('artistPage.noStats')}
            </p>
            {profile.bio && (
              <p className="mt-2 line-clamp-3 max-w-3xl text-[13px] leading-5 text-muted">
                {profile.bio}
              </p>
            )}
            {tracks.length > 0 && (
              <button
                type="button"
                onClick={() => enqueue(tracks.map((track) => track.track_ref))}
                className="mt-3 rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-on-accent transition hover:brightness-105"
              >
                {t('artistPage.addAll')}
              </button>
            )}
          </div>
        </div>

        <h2 className="mb-4 text-2xl font-bold text-paper">{t('artistPage.topTracks')}</h2>
        {tracks.length > 0 ? (
          <TrackList tracks={tracks} />
        ) : (
          <p className="py-10 text-center text-sm text-faint">{t('artistPage.empty')}</p>
        )}
      </section>
    </div>
  );
}
