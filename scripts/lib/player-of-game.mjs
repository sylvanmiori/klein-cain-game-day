export const PLAYER_OF_GAME_MODEL = 'Cain Impact v1';

// Editorial overrides, keyed by edition slug. The editor may overrule the
// model's pick; the override selects the named player's verified game row and
// the model still writes the headline/rationale from that row, so the card
// stays reproducible and stat-backed. (Steven, 2026-10-04: Gilstrap over Hanks
// for the Collins loss; two interceptions in a loss is the wrong look.)
const PLAYER_OF_GAME_OVERRIDES = {
  '2026-10-01-klein-collins': { number: '42' }, // Jaemin Gilstrap
};

const value = (player, key) => Number(player[key]) || 0;
const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count === 1 ? singular : pluralForm}`;

function score(player) {
  return value(player, 'passingYards') * 0.04
    + value(player, 'passingTouchdowns') * 4
    - value(player, 'passingInterceptions') * 2
    + value(player, 'rushingYards') * 0.1
    + value(player, 'rushingTouchdowns') * 6
    + value(player, 'receivingYards') * 0.1
    + value(player, 'receivingTouchdowns') * 6
    + value(player, 'totalTackles') * 0.75
    + value(player, 'tacklesForLoss') * 1.5
    + value(player, 'sacks') * 3
    + value(player, 'defensiveInterceptions') * 5
    + value(player, 'forcedFumbles') * 4
    + value(player, 'fumbleRecoveries') * 4
    + value(player, 'kickingPoints') * 0.8;
}

function totalTouchdowns(player) {
  return value(player, 'passingTouchdowns')
    + value(player, 'rushingTouchdowns')
    + value(player, 'receivingTouchdowns');
}

function headline(player) {
  const passing = value(player, 'passingYards');
  const rushing = value(player, 'rushingYards');
  const receiving = value(player, 'receivingYards');
  const touchdowns = totalTouchdowns(player);
  const scrimmage = rushing + receiving;
  if (passing > 0 && rushing > 0) {
    return `${passing + rushing} yards of offense${touchdowns ? ` · ${plural(touchdowns, 'TD')}` : ''}`;
  }
  if (scrimmage > 0) {
    return `${scrimmage} yards from scrimmage${touchdowns ? ` · ${plural(touchdowns, 'TD')}` : ''}`;
  }
  const tackles = value(player, 'totalTackles');
  const impactPlays = value(player, 'tacklesForLoss') + value(player, 'sacks')
    + value(player, 'defensiveInterceptions') + value(player, 'forcedFumbles') + value(player, 'fumbleRecoveries');
  if (tackles > 0) return `${plural(tackles, 'tackle')}${impactPlays ? ` · ${plural(impactPlays, 'impact play')}` : ''}`;
  return `${plural(value(player, 'kickingPoints'), 'kicking point')}`;
}

function rationale(player) {
  const parts = [];
  const passing = value(player, 'passingYards');
  const rushing = value(player, 'rushingYards');
  const receiving = value(player, 'receivingYards');
  const passTds = value(player, 'passingTouchdowns');
  const rushTds = value(player, 'rushingTouchdowns');
  const recTds = value(player, 'receivingTouchdowns');
  if (passing) parts.push(`${passing} passing yards${passTds ? ` and ${plural(passTds, 'passing touchdown')}` : ''}`);
  if (rushing) parts.push(`${rushing} rushing yards${rushTds ? ` and ${plural(rushTds, 'rushing touchdown')}` : ''}`);
  if (receiving) parts.push(`${plural(receiving, 'receiving yard')}${recTds ? ` and ${plural(recTds, 'receiving touchdown')}` : ''}`);

  const tackles = value(player, 'totalTackles');
  const defense = [];
  if (tackles) defense.push(plural(tackles, 'tackle'));
  if (value(player, 'tacklesForLoss')) defense.push(plural(value(player, 'tacklesForLoss'), 'tackle for loss', 'tackles for loss'));
  if (value(player, 'sacks')) defense.push(plural(value(player, 'sacks'), 'sack'));
  if (value(player, 'defensiveInterceptions')) defense.push(plural(value(player, 'defensiveInterceptions'), 'interception'));
  if (value(player, 'forcedFumbles')) defense.push(plural(value(player, 'forcedFumbles'), 'forced fumble'));
  if (value(player, 'fumbleRecoveries')) defense.push(plural(value(player, 'fumbleRecoveries'), 'fumble recovery', 'fumble recoveries'));
  if (defense.length) parts.push(defense.join(', '));
  if (value(player, 'kickingPoints')) parts.push(plural(value(player, 'kickingPoints'), 'kicking point'));

  const last = parts.pop();
  const statLine = parts.length ? `${parts.join(', ')}, and ${last}` : last;
  return `${player.name.split(' ').at(-1)} finished with ${statLine}.`;
}

/**
 * Pick one covered-team player from verified game-only rows. The weights are
 * intentionally simple and frozen by model version so the weekly choice is
 * reproducible. Ties go to touchdowns, yards from scrimmage, tackles, then
 * jersey number. No opponent data, season totals or recruiting ratings enter.
 */
export function selectPlayerOfGame(players, opts = {}) {
  const format = (winner) => ({
    name: winner.name,
    number: String(winner.number),
    ...(winner.image ? { image: winner.image } : {}),
    headline: headline(winner),
    rationale: rationale(winner),
    model: PLAYER_OF_GAME_MODEL,
  });
  const override = opts.slug ? PLAYER_OF_GAME_OVERRIDES[opts.slug] : null;
  if (override) {
    const pick = players.find((player) => String(player.number) === String(override.number));
    if (pick && (score(pick) > 0 || value(pick, 'totalTackles') > 0)) return format(pick);
  }
  const candidates = players
    .map((player) => ({ player, impact: score(player) }))
    .filter(({ impact }) => impact > 0)
    .sort((a, b) => b.impact - a.impact
      || totalTouchdowns(b.player) - totalTouchdowns(a.player)
      || (value(b.player, 'rushingYards') + value(b.player, 'receivingYards'))
        - (value(a.player, 'rushingYards') + value(a.player, 'receivingYards'))
      || value(b.player, 'totalTackles') - value(a.player, 'totalTackles')
      || Number(a.player.number || 999) - Number(b.player.number || 999));
  if (!candidates.length) return null;
  return format(candidates[0].player);
}
