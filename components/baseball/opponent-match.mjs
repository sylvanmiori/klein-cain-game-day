export function normalizeOpponent(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function opponentsMatch(left, right) {
  const a = normalizeOpponent(left);
  const b = normalizeOpponent(right);
  if (!a || !b) return false;
  if (a === b) return true;

  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  return shorter.length >= 8 && longer.includes(shorter);
}

/** Find the saved D1 row for one schedule game (unique date + opponent match). */
export function findSavedGame(scheduledGame, siblingScheduleGames, savedGames) {
  const matches = savedGames.filter(
    (game) =>
      game.date === scheduledGame.date &&
      opponentsMatch(game.opponent, scheduledGame.opponent) &&
      typeof game.result === 'string' &&
      game.result.trim().length > 0,
  );

  if (matches.length !== 1) return null;

  const scheduledMatches = siblingScheduleGames.filter(
    (game) =>
      game.date === scheduledGame.date &&
      opponentsMatch(game.opponent, matches[0].opponent),
  );

  return scheduledMatches.length === 1 ? matches[0] : null;
}
