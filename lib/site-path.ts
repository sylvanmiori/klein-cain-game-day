export function sitePath(path: string) {
  const base = process.env.GITHUB_ACTIONS === 'true' ? '/klein-cain-game-day' : '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
