// Composes the postgame recap from verified data only.
//
// No language model is involved and nothing here is inferred. Every sentence
// restates something already checked: the final score, the venue and date, the
// season record derived from captured results, and the published pick. There is
// deliberately nothing about how any individual played, because no verified
// postgame player statistics are available from the sources this site uses.

const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

function apDate(isoDate) {
  const [, month, day] = isoDate.split('-');
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

/** Win-loss record after a given date, from captured final scores only. */
export function recordThrough(editions, schoolName, date) {
  let wins = 0;
  let losses = 0;
  for (const edition of editions) {
    if (edition.date > date || !edition.finalScore) continue;
    const isHome = edition.home.name === schoolName;
    const ours = isHome ? edition.finalScore.home : edition.finalScore.away;
    const theirs = isHome ? edition.finalScore.away : edition.finalScore.home;
    if (ours > theirs) wins += 1;
    else if (theirs > ours) losses += 1;
  }
  return `${wins}–${losses}`;
}

/**
 * Build the `final` section for a played game. Returns null when the game has
 * no captured score, so a recap can never precede a verified result.
 */
export function composeRecap({ edition, editions, schoolName, desk, siteName = 'Cain Game Day', now = new Date() }) {
  const score = edition.finalScore;
  if (!score) return null;

  const isHome = edition.home.name === schoolName;
  const ours = isHome ? score.home : score.away;
  const theirs = isHome ? score.away : score.home;
  const opponent = isHome ? edition.away : edition.home;
  const margin = Math.abs(ours - theirs);
  const won = ours > theirs;
  const tied = ours === theirs;

  const headline = tied
    ? `${schoolName} and ${opponent.name} tie, ${ours}–${theirs}`
    : won
      ? `${schoolName} beats ${opponent.name}, ${ours}–${theirs}`
      : `${opponent.name} beats ${schoolName}, ${theirs}–${ours}`;

  const where = isHome ? `at ${edition.venue}` : `at ${opponent.name}`;
  const sentences = [
    tied
      ? `${schoolName} and ${opponent.name} finished ${ours}–${theirs} ${where} on ${apDate(edition.date)}.`
      : `${schoolName} ${won ? 'beat' : 'lost to'} ${opponent.name} ${ours}–${theirs} ${where} on ${apDate(edition.date)}, a ${margin}-point ${won ? 'win' : 'loss'}.`,
    `${schoolName} is ${recordThrough(editions, schoolName, edition.date)}.`,
  ];

  // Compare against whichever prediction the page published before kickoff.
  const pick = edition.rating ?? edition.massey ?? edition.prediction;
  if (pick && Number.isFinite(pick.margin)) {
    const predicted = Math.round(pick.margin);
    const favored = predicted === 0 ? null : predicted > 0 ? schoolName : opponent.name;
    const actual = ours - theirs;
    const winner = won ? schoolName : opponent.name;
    sentences.push(favored
      ? (actual > 0) === (predicted > 0)
        ? `${pick.source} had ${favored} by ${Math.abs(predicted)}; the margin was ${Math.abs(actual)}.`
        : `${pick.source} had ${favored} by ${Math.abs(predicted)}; ${winner} won by ${Math.abs(actual)}.`
      : `${pick.source} called it even.`);
  }

  const updated = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit',
  }).format(now);

  // A page titled "Preview" after the game is simply wrong, so the recap also
  // supplies the titles. The wording follows the existing Week 2 pattern.
  const titles = {
    pageTitle: `${edition.date.slice(0, 4)} Week ${edition.week} Final: ${edition.away.name} at ${edition.home.name}`,
    metaTitle: tied
      ? `Final: ${schoolName} ${ours}, ${opponent.name} ${theirs} | ${siteName}`
      : `Final: ${won ? schoolName : opponent.name} ${Math.max(ours, theirs)}, ${
        won ? opponent.name : schoolName} ${Math.min(ours, theirs)} | ${siteName}`,
    metaDescription: `Final score and game report for ${headline.replace(/,([^,]*)$/, ',$1')}.`,
    socialDescription: `Final score and verified game facts from ${schoolName}'s Week ${edition.week} game against ${opponent.name}.`,
  };

  return {
    titles,
    headline,
    byline: `${desk} · Updated ${updated} CT`,
    body: sentences.join(' '),
    homeScore: score.home,
    awayScore: score.away,
    quarters: null,
    notes: [],
    // Left empty on purpose: no verified postgame player statistics exist in
    // the sources this site uses, and pregame players to watch must never be
    // presented as though they performed.
    leaders: null,
  };
}
