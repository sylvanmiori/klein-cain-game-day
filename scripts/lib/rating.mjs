// A least-squares team rating computed from Texas high school results.
//
// This is the classic Massey method, which is public: for every game assert
// rating(winner) - rating(loser) = margin, then solve the overdetermined system
// by least squares. It is NOT the rating published on masseyratings.com, which
// is a refined proprietary system. Anything produced here is our own number and
// must be labelled that way.
//
// Two deliberate modelling choices, both ours rather than derived from data:
//   - Margins are capped, because running up the score should not be rewarded.
//   - A small ridge term regularizes the system, which keeps it solvable while
//     the season is young and the game graph is still in disconnected pieces.

/** Blowouts beyond this margin count as this margin. */
export const MARGIN_CAP = 28;
/** Ridge term. Pulls teams with little evidence toward the average. */
export const RIDGE = 1.0;
/** A team needs at least this many results before it earns a rating. */
export const MIN_GAMES = 4;

const normalize = (value) => String(value || '').trim();

/**
 * Turn score rows into the game list the solver needs. Only completed games
 * with usable scores count, and each meeting is taken once.
 */
export function buildGames(rows) {
  const seen = new Set();
  const games = [];
  for (const row of rows) {
    if (!/final/i.test(String(row.status || ''))) continue;
    const home = normalize(row.school);
    const away = normalize(row.opponent);
    if (!home || !away) continue;
    const forScore = Number(row.score);
    const againstScore = Number(row.opponentScore);
    if (!Number.isInteger(forScore) || !Number.isInteger(againstScore)) continue;
    if (forScore < 0 || againstScore < 0 || forScore > 200 || againstScore > 200) continue;

    // Each game appears twice, once from each school's point of view, and the
    // two rows carry DIFFERENT game ids. The date plus the team pair is the
    // only stable key; using gameId here would double-count every game.
    const key = `${row.gameDate ?? ''}|${[home, away].sort().join('|')}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const atHome = String(row.location || '').toLowerCase() === 'home';
    games.push({
      home: atHome ? home : away,
      away: atHome ? away : home,
      homeScore: atHome ? forScore : againstScore,
      awayScore: atHome ? againstScore : forScore,
      neutral: !['home', 'away'].includes(String(row.location || '').toLowerCase()),
    });
  }
  return games;
}

/** Average home margin, used as the home-field term. */
export function homeAdvantage(games) {
  const played = games.filter((game) => !game.neutral);
  if (played.length === 0) return 0;
  const total = played.reduce((sum, game) => sum + (game.homeScore - game.awayScore), 0);
  return total / played.length;
}

const cap = (margin) => Math.max(-MARGIN_CAP, Math.min(MARGIN_CAP, margin));

/**
 * Solve (M + ridge*I) r = p by Gaussian elimination with partial pivoting.
 * M is the Massey matrix: games played on the diagonal, minus the number of
 * meetings off it. The ridge term makes it non-singular, so no row has to be
 * replaced with the usual all-ones constraint.
 */
export function rate(games) {
  const index = new Map();
  for (const game of games) {
    for (const team of [game.home, game.away]) {
      if (!index.has(team)) index.set(team, index.size);
    }
  }
  const n = index.size;
  if (n === 0) return { ratings: new Map(), games: new Map(), homeEdge: 0 };

  const matrix = new Float64Array(n * n);
  const vector = new Float64Array(n);
  const counts = new Map();
  const homeEdge = homeAdvantage(games);

  for (const game of games) {
    const i = index.get(game.home);
    const j = index.get(game.away);
    // Remove the home-field term so ratings measure team strength alone.
    const margin = cap(game.homeScore - game.awayScore - (game.neutral ? 0 : homeEdge));
    matrix[i * n + i] += 1;
    matrix[j * n + j] += 1;
    matrix[i * n + j] -= 1;
    matrix[j * n + i] -= 1;
    vector[i] += margin;
    vector[j] -= margin;
    counts.set(game.home, (counts.get(game.home) ?? 0) + 1);
    counts.set(game.away, (counts.get(game.away) ?? 0) + 1);
  }
  for (let i = 0; i < n; i += 1) matrix[i * n + i] += RIDGE;

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(matrix[row * n + col]) > Math.abs(matrix[pivot * n + col])) pivot = row;
    }
    if (Math.abs(matrix[pivot * n + col]) < 1e-12) throw new Error('Rating system is singular.');
    if (pivot !== col) {
      for (let k = 0; k < n; k += 1) {
        const swap = matrix[col * n + k];
        matrix[col * n + k] = matrix[pivot * n + k];
        matrix[pivot * n + k] = swap;
      }
      const swap = vector[col];
      vector[col] = vector[pivot];
      vector[pivot] = swap;
    }
    const diagonal = matrix[col * n + col];
    for (let row = col + 1; row < n; row += 1) {
      const factor = matrix[row * n + col] / diagonal;
      if (factor === 0) continue;
      for (let k = col; k < n; k += 1) matrix[row * n + k] -= factor * matrix[col * n + k];
      vector[row] -= factor * vector[col];
    }
  }

  const solution = new Float64Array(n);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = vector[row];
    for (let k = row + 1; k < n; k += 1) sum -= matrix[row * n + k] * solution[k];
    solution[row] = sum / matrix[row * n + row];
  }

  const ratings = new Map();
  for (const [team, i] of index) ratings.set(team, solution[i]);
  return { ratings, games: counts, homeEdge };
}

/**
 * Predicted margin for one matchup, from the home team's point of view.
 * Returns null when either team has too little evidence to rate.
 */
export function predict({ ratings, games, homeEdge }, homeTeam, awayTeam) {
  const home = ratings.get(homeTeam);
  const away = ratings.get(awayTeam);
  if (home === undefined || away === undefined) return null;
  if ((games.get(homeTeam) ?? 0) < MIN_GAMES || (games.get(awayTeam) ?? 0) < MIN_GAMES) return null;
  return { home, away, margin: home - away + homeEdge };
}
