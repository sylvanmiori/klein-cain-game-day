// Keep in sync with scripts/lib/prediction-margin.mjs (recap runs in plain Node).

export type MarginBasis = 'home' | 'school';

export function marginFromSchoolPerspective(
  homeName: string,
  awayName: string,
  schoolName: string,
  margin: number,
  basis: MarginBasis,
): number {
  if (basis === 'school') return margin;
  const schoolIsHome = homeName === schoolName;
  return schoolIsHome ? margin : -margin;
}

export function formatFavoriteMargin(
  schoolMargin: number,
  schoolName: string,
  opponentName: string,
): { favorite: string | null; value: string; rounded: number } {
  const rounded = Math.round(schoolMargin);
  if (rounded === 0) return { favorite: null, value: 'Even', rounded: 0 };
  const favorite = rounded > 0 ? schoolName : opponentName;
  return { favorite, value: `${favorite} by ${Math.abs(rounded)}`, rounded };
}

type PickLike = { margin: number };

type EditionSides = {
  home: { name: string };
  away: { name: string };
  rating?: PickLike | null;
  massey?: PickLike | null;
  prediction?: PickLike | null;
};

export function schoolMarginForPublishedPick(
  edition: EditionSides,
  schoolName: string,
  pick: PickLike,
): number {
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
