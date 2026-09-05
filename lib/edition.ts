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
  prediction: { home: number; away: number; winProbability: number; source: string } | null;
  weather: { label: string; detail: string } | null;
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

export function editionByWeek(week: number) {
  return editions.find((edition) => edition.week === week);
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
