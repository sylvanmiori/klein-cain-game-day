/**
 * Utilities for high-quality sports photo captioning and roster resolution.
 * Enforces editorial standards: photo captions and alt text must identify
 * athletes by name, position, and class rather than raw/unresolved jersey numbers.
 */

const LOW_QUALITY_PATTERNS = [
  // "Jersey 1 turns upfield", "Jerseys 10, 9 and 23"
  /\bjerseys?\s+\d+/i,
  // "ball carrier in jersey 1", "defender in jersey 2"
  /\b(?:ball\s*carrier|defender|player|receiver|rusher|lineman|tackler|center|quarterback|safety|cornerback|kicker|punter)\s+in\s+jersey\s+\d+/i,
  // "jersey number 1", "jersey #1"
  /\bjersey\s+(?:number|#)\s*\d+/i,
  // Standalone unresolved "#1 turns upfield", "#69 sets"
  /(?:^|\s)#\d+\s+(?:turns|runs|sets|carries|closes|sprints|walks|lines|celebrates|fights|powers|awaits|prepares)/i,
];

/**
 * Checks whether a caption or alt text contains generic, low-IQ placeholder
 * phrasing referencing jersey numbers without identifying the player.
 *
 * @param {string} text - The caption or alt text to inspect
 * @returns {string | null} The matched generic pattern or null if clean
 */
export function detectLowQualityCaption(text) {
  if (!text || typeof text !== 'string') return null;
  for (const pattern of LOW_QUALITY_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

/**
 * Look up a player in the roster by their jersey number.
 *
 * @param {{ players?: Array<{ number: number | string; name: string; position?: string; class?: string }> }} roster
 * @param {number | string} number
 * @returns {{ number: number; name: string; position: string; class: string } | null}
 */
export function resolvePlayerByNumber(roster, number) {
  const num = typeof number === 'string' ? parseInt(number, 10) : number;
  if (!Number.isFinite(num) || !roster?.players) return null;

  const player = roster.players.find((p) => Number(p.number) === num);
  if (!player) return null;

  return {
    number: Number(player.number),
    name: player.name,
    position: player.position && player.position !== '—' ? player.position : '',
    class: player.class && player.class !== '—' ? player.class : '',
  };
}

/**
 * Format a player with class, position, name, and jersey number in sports journalism style.
 * E.g., "Junior running back Earl Oguinn Jr. (1)" or "Senior defensive back Michael Elhindi (2)"
 *
 * @param {{ number: number; name: string; position?: string; class?: string }} player
 * @returns {string}
 */
export function formatPlayerJournalismStyle(player) {
  if (!player?.name) return '';

  const classNames = {
    'Fr.': 'Freshman',
    'So.': 'Sophomore',
    'Jr.': 'Junior',
    'Sr.': 'Senior',
  };

  const positionNames = {
    'RB': 'running back',
    'WR': 'wide receiver',
    'QB': 'quarterback',
    'DB': 'defensive back',
    'CB': 'cornerback',
    'FS': 'free safety',
    'SS': 'strong safety',
    'LB': 'linebacker',
    'MLB': 'middle linebacker',
    'OL': 'offensive lineman',
    'OT': 'offensive tackle',
    'OG': 'offensive guard',
    'C': 'center',
    'DL': 'defensive lineman',
    'DE': 'defensive end',
    'DT': 'defensive tackle',
    'TE': 'tight end',
    'K': 'kicker',
    'P': 'punter',
    'K / P': 'kicker/punter',
    'TE / LS': 'tight end',
    'RB / WR': 'running back',
    'RB / SB': 'running back',
  };

  const grade = classNames[player.class] || '';
  const pos = positionNames[player.position] || (player.position ? player.position.toLowerCase() : '');

  const rolePrefix = [grade, pos].filter(Boolean).join(' ');
  const numberSuffix = player.number !== undefined ? ` (${player.number})` : '';

  if (rolePrefix) {
    // Capitalize first letter of role prefix
    const capitalizedRole = rolePrefix.charAt(0).toUpperCase() + rolePrefix.slice(1);
    return `${capitalizedRole} ${player.name}${numberSuffix}`;
  }

  return `${player.name}${numberSuffix}`;
}
