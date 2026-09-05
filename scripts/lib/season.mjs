// Which edition the home page shows on a given day.
//
// A played game keeps the home page for a few days so the result is the first
// thing a reader sees, then the next preview takes over. With the default hold
// a Friday game is still current through Monday and hands over on Tuesday.

export const HOLD_DAYS = 3;

const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);

/** `editions` need only a `date`; the whole edition is returned. */
export function pickCurrent(editions, day, holdDays = HOLD_DAYS) {
  const byDate = [...editions].sort((a, b) => a.date.localeCompare(b.date));
  if (byDate.length === 0) return null;
  const played = byDate.filter((edition) => edition.date <= day);
  const latest = played[played.length - 1];
  if (latest && daysBetween(latest.date, day) <= holdDays) return latest;
  return byDate.find((edition) => edition.date > day) ?? latest ?? byDate[0];
}
