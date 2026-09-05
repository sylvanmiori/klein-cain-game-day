// Edition schema v2. Every game-specific string the site renders comes from one
// edition file in content/editions. Nothing about an opponent belongs in a
// component or a route. See docs/PROJECT-GUIDE.md for the publishing rules.

export type Team = {
  name: string;
  mascot: string;
  logo: string;
  record: string;
  /** Dave Campbell's Texas statewide rank, or null when none was verified. */
  rank: number | null;
};

export type Fact = {
  label: string;
  value: string;
  href?: string;
  /**
   * Which side a fact describes, so it can carry that team's colour. Named by
   * role rather than by venue, because the school is the away team in a road
   * game and the colour should not flip with it.
   */
  team?: 'school' | 'opponent';
};

export type EditionPlayer = {
  team: string;
  number: string;
  name: string;
  image: string;
  role: string;
  tag: string;
  rating: string;
  copy: string;
};

export type RecruitRow = {
  number: string;
  name: string;
  team: string;
  note: string;
  href: string;
  linkLabel: string;
};

export type Leader = {
  name: string;
  number: string;
  role: string;
  image: string;
  stat: string;
  detail: string;
};

export type PreviewSection = {
  playersHeading: string;
  players: EditionPlayer[];
  playersNote: string;
  intro: { heading: string; body: string; facts: Fact[] } | null;
  recruiting: { heading: string; rows: RecruitRow[]; note: string } | null;
  keys: { heading: string; items: { title: string; body: string }[] } | null;
  gameInfo: { heading: string; facts: Fact[]; links: { label: string; href: string }[] } | null;
};

export type FinalSection = {
  headline: string;
  byline: string;
  body: string;
  /** Verified final score, in venue order. Null while a result is unconfirmed. */
  homeScore: number | null;
  awayScore: number | null;
  quarters: { labels: string[]; rows: { team: string; scores: string[]; total: string }[] } | null;
  notes: { heading: string; paragraphs: string[] }[];
  leaders: { heading: string; source: string; items: Leader[] } | null;
};

export type Edition = {
  schemaVersion: 2;
  slug: string;
  week: number;
  issue: string;
  /** Editorial state of the page, independent of the live score feed. */
  state: 'preview' | 'final';
  date: string;
  dateLong: string;
  dateShort: string;
  kickoff: string;
  venue: string;
  event: string;
  updated: string;
  /** True when the home team is the school this site covers. */
  home: Team;
  away: Team;
  pageTitle: string;
  metaTitle: string;
  metaDescription: string;
  socialDescription: string;
  ogImage: string;
  /* The two fields below are machine-owned: scripts/refresh-facts.mjs writes
     them from named public sources and nothing else may. Both carry their own
     attribution and an asOf stamp so the page can say how fresh a number is. */
  prediction: {
    /** Signed margin from the covered school's point of view. */
    margin: number;
    source: string;
    sourceUrl: string;
    asOf: string;
  } | null;
  /**
   * Massey's published number. Preferred over the Dave Campbell's pick when we
   * have it, but masseyratings.com answers automated requests with a bot
   * challenge and disallows its data paths, so nothing fills this today. The
   * slot exists so the preference order is explicit and it can be populated the
   * day a permitted route appears.
   */
  massey: { margin: number; source: string; sourceUrl: string; asOf: string } | null;
  /** Attribution for the statewide ranks held on home.rank and away.rank. */
  rankings: { source: string; sourceUrl: string; asOf: string } | null;
  /**
   * Season stat leaders for the covered school, snapshotted once a game is
   * played and the source has been updated to include it. These are
   * season-to-date figures, never one game's box score, and the page says so.
   */
  stats: {
    leaders: {
      category: string;
      header: string;
      name: string;
      position: string;
      value: string;
      rank: number | null;
    }[];
    /** When the source itself last entered statistics. */
    updated: string;
    source: string;
    sourceUrl: string;
    asOf: string;
  } | null;
  /** Verified final score, captured from the score feed once a game is played. */
  finalScore: { home: number; away: number; source: string; sourceUrl: string; asOf: string } | null;
  /** Our own least-squares rating, published only once the season supports it. */
  rating: {
    home: number;
    away: number;
    /** Predicted margin from the covered school's point of view. */
    margin: number;
    method: string;
    source: string;
    sourceUrl: string;
    asOf: string;
  } | null;
  weather: {
    tempF: number;
    condition: string;
    precipPct: number | null;
    humidityPct: number | null;
    wind: string | null;
    source: string;
    sourceUrl: string;
    asOf: string;
  } | null;
  /** Facts shown under the matchup card before kickoff. */
  scheduledFacts: Fact[];
  /** Facts shown under the matchup card once a score exists. */
  resultFacts: Fact[];
  /** Null for a game archived without a preserved preview. */
  preview: PreviewSection | null;
  final: FinalSection | null;
  sources: { label: string; href: string }[];
  /** One line in the footer of a non-current edition page. */
  footerNote: string;
  /** Organizations named in the footer's not-affiliated line. */
  disclaimerEntities: string[];
  /** Set on exactly one edition; drives the home page and the live score card. */
  current: boolean;
};

const modules = import.meta.glob('../content/editions/*.json', { eager: true }) as Record<
  string,
  { default: Edition }
>;

export const editions: Edition[] = Object.values(modules)
  .map((module) => module.default)
  .sort((a, b) => a.date.localeCompare(b.date));

export const currentEdition: Edition = editions.find((edition) => edition.current) ?? editions[editions.length - 1];

export function editionPath(edition: Edition) {
  return edition.current ? '/' : `/games/week-${edition.week}`;
}

/** The team on the page that is not the school this site covers. */
export function opponentOf(edition: Edition, schoolName: string) {
  return edition.home.name === schoolName ? edition.away : edition.home;
}

/** The freshest statistics snapshot we hold, for pages that are not a game. */
export function latestEditionWithStats(): Edition | null {
  return [...editions].reverse().find((edition) => edition.stats) ?? null;
}

/** The next game that has not been played, for a "what's next" card. */
export function nextEdition(today: string): Edition | null {
  return editions.find((edition) => edition.date > today && !edition.finalScore) ?? null;
}

export function editionByWeek(week: number) {
  return editions.find((edition) => edition.week === week);
}

/**
 * One prediction, chosen in a fixed order of preference: our own rating first,
 * then Massey, then the Dave Campbell's pick. The label names the source, so a
 * reader always knows whose number they are looking at. A game should never
 * show no prediction, which the validator enforces.
 */
export function predictionFact(edition: Edition, schoolName: string): Fact | null {
  const candidates: { label: string; margin: number; href?: string }[] = [
    edition.rating && { label: 'Our rating', margin: edition.rating.margin },
    edition.massey && { label: 'Massey', margin: edition.massey.margin, href: edition.massey.sourceUrl },
    // No href: this margin comes from Dave Campbell's data feed, which appears
    // to drive their Pick'Em contest, and is not displayed on any public page.
    // Linking it would send a reader somewhere the number is not shown.
    edition.prediction && { label: 'Model prediction', margin: edition.prediction.margin },
  ].filter((candidate): candidate is { label: string; margin: number; href?: string } => Boolean(candidate));

  const chosen = candidates[0];
  if (!chosen) return null;
  const opponent = opponentOf(edition, schoolName);
  const rounded = Math.round(chosen.margin);
  const favorite = rounded === 0 ? null : rounded > 0 ? schoolName : opponent.name;
  return {
    label: chosen.label,
    value: favorite ? `${favorite} by ${Math.abs(rounded)}` : 'Even',
    href: chosen.href,
  };
}

/** Leaders grouped by category, keeping the order the source published. */
export function groupedLeaders(edition: Edition) {
  const groups: { category: string; header: string; rows: Edition['stats'] extends null ? never : NonNullable<Edition['stats']>['leaders'] }[] = [];
  for (const leader of edition.stats?.leaders ?? []) {
    const existing = groups.find((group) => group.category === leader.category);
    if (existing) existing.rows.push(leader);
    else groups.push({ category: leader.category, header: leader.header, rows: [leader] });
  }
  return groups;
}

/** Statewide computer rank for both teams, when it has been fetched. */
export function rankFact(edition: Edition): Fact | null {
  const { home, away, rankings } = edition;
  if (home.rank === null || away.rank === null || !rankings) return null;
  return {
    label: 'Texas rank',
    value: `${away.name} ${away.rank} · ${home.name} ${home.rank}`,
    href: rankings.sourceUrl,
  };
}

/** A forecast goes stale quickly, so an old one is dropped rather than shown. */
const FORECAST_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

/** Forecast for the kickoff hour, never presented as a certainty. */
export function weatherFact(edition: Edition, now = Date.now()): Fact | null {
  const weather = edition.weather;
  if (!weather) return null;
  const asOf = Date.parse(weather.asOf);
  if (!Number.isFinite(asOf) || now - asOf > FORECAST_MAX_AGE_MS) return null;
  const parts = [`${weather.tempF}°F`, weather.condition];
  if (weather.precipPct !== null) parts.push(`${weather.precipPct}% rain`);
  return { label: 'Forecast', value: parts.join(' · '), href: weather.sourceUrl };
}

/** Every school named on the page, used for the not-affiliated footer line. */
export function disclaimerLine(edition: Edition) {
  const names = edition.disclaimerEntities;
  const list = names.length > 1
    ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
    : names.join('');
  return `Independent fan publication. Not affiliated with ${list}.`;
}

const apMonths = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

/** AP-style short date, matching how dates read elsewhere on the page. */
export function apDate(isoDate: string, withYear = false) {
  const [year, month, day] = isoDate.split('-');
  const base = `${apMonths[Number(month) - 1]} ${Number(day)}`;
  return withYear ? `${base}, ${year}` : base;
}
