/**
 * 房间深链（/r/:roomId，兼容旧 /room/:roomId）：进房后回首页，有当前曲目则直达全屏播放页。
 * 房间在外壳架构里是状态而非页面，深链只承担「切换房间」这一动作；?key= 携带入房凭据
 * （分享链接场景，静态密码或动态码），joined 后凭据已持久化、URL 被 replace 不残留。
 */
import { useCallback, useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { roomStore } from '../app/session';
import { useShell, type JoinResult } from './AppShell';

export default function RoomDeepLink(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { roomId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const credential = searchParams.get('key') ?? undefined;
  const { joinRoom, setFullscreenOpen } = useShell();
  const [result, setResult] = useState<JoinResult | null>(null);
  const [password, setPassword] = useState('');

  const completeJoin = useCallback(
    (next: JoinResult) => {
      if (next !== 'joined') {
        setResult(next);
        return;
      }
      // SessionStore.join 仅在 playback/queue/radio/listeners 四份首快照齐备后 resolve，
      // 因而此处可直接判断本房当前曲目，无需另起快照订阅或超时兜底。
      if (roomStore.getState().playback.current) setFullscreenOpen(true);
      navigate('/', { replace: true });
    },
    [navigate, setFullscreenOpen],
  );

  useEffect(() => {
    setResult(null);
    let dead = false;
    void joinRoom(roomId, credential).then((next) => {
      if (!dead) completeJoin(next);
    });
    return () => {
      dead = true;
    };
  }, [roomId, credential, joinRoom, completeJoin]);

  return (
    <div className="view-enter mx-auto max-w-sm px-7 pt-24">
      {result === null && <p className="text-center text-muted">{t('shell.deepLinkJoining')}</p>}
      {result === 'failed' && (
        <p className="text-center text-muted">{t('shell.deepLinkFailed')}</p>
      )}
      {result === 'need_credential' && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!password) return;
            void joinRoom(roomId, password).then(completeJoin);
          }}
        >
          <p className="mb-4 text-muted">{t('room.needCredential')}</p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('room.credentialPlaceholder')}
            className="mb-4 w-full rounded-md border border-hairline bg-panel px-4 py-2.5 placeholder:text-faint"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-accent py-2.5 font-medium text-on-accent"
          >
            {t('room.join')}
          </button>
        </form>
      )}
    </div>
  );
}
