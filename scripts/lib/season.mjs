// Which edition the live score card follows on a given day.
//
// The latest result stays current between games. The next preview takes over on
// the Monday of that game's week, so game-day readers always land on the right
// matchup without leaving the previous final on the live card through a long open week.

const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);

/** Monday of the calendar week containing `gameDate` (YYYY-MM-DD). */
export function mondayOfGameWeek(gameDate) {
  const date = new Date(`${gameDate}T12:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

/** `editions` need only a `date`; the whole edition is returned. */
export function pickCurrent(editions, day) {
  const byDate = [...editions].sort((a, b) => a.date.localeCompare(b.date));
  if (byDate.length === 0) return null;
  const played = byDate.filter((edition) => edition.date <= day);
  const latest = played[played.length - 1];
  if (latest?.date === day) return latest;
  const upcoming = byDate.find((edition) => edition.date > day);
  if (!latest) return upcoming ?? byDate[0];
  if (upcoming && day >= mondayOfGameWeek(upcoming.date)) return upcoming;
  return latest;
}
