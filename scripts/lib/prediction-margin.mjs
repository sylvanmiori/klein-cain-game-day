/**
 * Signed margins are not all stored the same way. Our least-squares rating uses
 * the home team's perspective (see predict() in rating.mjs). Dave Campbell's
 * pick is from Klein Cain's perspective. Display and recap logic must convert
 * before naming a favorite.
 */

/** @typedef {'home' | 'school'} MarginBasis */

/**
 * @param {string} homeName
 * @param {string} awayName
 * @param {string} schoolName
 * @param {number} margin
 * @param {MarginBasis} basis
 */
export function marginFromSchoolPerspective(homeName, awayName, schoolName, margin, basis) {
  if (basis === 'school') return margin;
  const schoolIsHome = homeName === schoolName;
  return schoolIsHome ? margin : -margin;
}

/**
 * @param {number} schoolMargin margin from the covered school's perspective
 * @param {string} schoolName
 * @param {string} opponentName
 */
export function formatFavoriteMargin(schoolMargin, schoolName, opponentName) {
  const rounded = Math.round(schoolMargin);
  if (rounded === 0) return { favorite: null, value: 'Even', rounded: 0 };
  const favorite = rounded > 0 ? schoolName : opponentName;
  return { favorite, value: `${favorite} by ${Math.abs(rounded)}`, rounded };
}

/**
 * @param {{ home: { name: string }, away: { name: string }, rating?: { margin: number } | null, massey?: { margin: number } | null, prediction?: { margin: number } | null }} edition
 * @param {string} schoolName
 * @param {{ margin: number }} pick
 */
export function schoolMarginForPublishedPick(edition, schoolName, pick) {
  if (edition.rating && pick === edition.rating) {
    return marginFromSchoolPerspective(
      edition.home.name,
      edition.away.name,
      schoolName,
      pick.margin,
      'home',
    );
  }
  return pick.margin;
}
