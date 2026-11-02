export const DEFAULT_NATIVE_SERVER = 'https://music.102.yuna.team';

export function resolveServerAddress(opts: {
  native: boolean;
  override?: string | null;
  runtime?: string;
  build?: string;
}): string {
  const normalize = (value?: string | null) => (value ?? '').trim().replace(/\/+$/, '');
  return (opts.native ? normalize(opts.override) : '') || normalize(opts.runtime) ||
    normalize(opts.build) || (opts.native ? DEFAULT_NATIVE_SERVER : '');
}
