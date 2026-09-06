// Which edition the home page shows on a given day.
//
// The latest result owns the home page between games. The next preview takes
// over one calendar day before kickoff, so game-day readers always land on the
// right matchup without replacing a useful final during a long open week.

const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);

/** `editions` need only a `date`; the whole edition is returned. */
export function pickCurrent(editions, day) {
  const byDate = [...editions].sort((a, b) => a.date.localeCompare(b.date));
  if (byDate.length === 0) return null;
  const played = byDate.filter((edition) => edition.date <= day);
  const latest = played[played.length - 1];
  if (latest?.date === day) return latest;
  const upcoming = byDate.find((edition) => edition.date > day);
  if (!latest) return upcoming ?? byDate[0];
  if (upcoming && daysBetween(day, upcoming.date) <= 1) return upcoming;
  return latest;
}
