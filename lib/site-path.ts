export function sitePath(path: string) {
  const base = process.env.DEPLOY_TARGET !== 'cloudflare' && process.env.GITHUB_ACTIONS === 'true' ? '/klein-cain-game-day' : '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
