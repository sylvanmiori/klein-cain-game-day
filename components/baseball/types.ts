// Shared types for the 4:13 Baseball subsite (app/baseball/*).

export interface ScheduleGame {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string;
  opponent: string;
  opponentRecord?: string;
  homeAway?: 'home' | 'away' | 'neutral';
  tournamentId?: string;
  venue?: string;
  field?: string;
  note?: string; // pool / group label
  result?: string | null;
  diamondkastUrl?: string;
}

export interface ScheduleTournament {
  id: string;
  name: string;
  dates: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  venue?: string;
  location?: string;
  /** Street address from Perfect Game (event_address) — used for maps links. */
  address?: string;
  notes?: string;
  pgUrl?: string;
  bracketUrl?: string;
}

export interface BaseballSchedule {
  tournaments: ScheduleTournament[];
  games: ScheduleGame[];
}

/** Season W-L-T derived from a results source (PG schedule or D1 box scores). */
export interface SeasonRecord {
  w: number;
  l: number;
  t: number;
  last: { opponent: string; result: string } | null;
}

export interface BracketGame {
  tier?: string;
  round: string;
  matchup: string;
  date?: string;
  time?: string;
  field?: string;
  venue?: string;
}

export interface BaseballBracket {
  tournamentName?: string;
  bracketUrl?: string;
  updated?: string;
  games: BracketGame[];
}

// ---- GET /api/baseball/bracket live-snapshot shapes ----
// Polled from Perfect Game by the Worker cron; see docs/baseball-bracket-poller.md.
export interface BracketTeam {
  seed?: string | null;
  name?: string | null;
  score?: number | null;
}

export interface LiveBracketGame {
  game_number: number;
  round?: string | null;
  date?: string | null;
  time?: string | null;
  field?: string | null;
  venue?: string | null;
  home: BracketTeam;
  away: BracketTeam;
  winner?: 'home' | 'away' | null;
}

export interface LiveBracketTier {
  tier: string;
  games: LiveBracketGame[];
}

export interface LiveBracketSnapshot {
  schemaVersion: number;
  event_id: string;
  tournament?: string | null;
  bracket_url?: string | null;
  tiers: LiveBracketTier[];
  game_count: number;
  scraped_at: string;
  updated_at?: string | null;
  source: string;
}

export interface RosterPlayer {
  name: string;
  pos: string;
  gradYear: number;
  bt?: string;
  ht?: string;
  wt?: string;
  hs?: string;
  hometown?: string;
}

// ---- /api/baseball/stats response shapes ----
export interface ApiPlayer {
  id: number;
  name: string;
  pos: string;
  grad_year: number;
  jersey_number?: number | null;
}

export interface ApiGame {
  id: number;
  date: string;
  opponent: string;
  tournament?: string;
  venue?: string;
  result?: string | null;
}

export interface BattingSeasonLine {
  player_id: number;
  name: string;
  gp: number;
  ab: number;
  r: number;
  h: number;
  '1b': number;
  '2b': number;
  '3b': number;
  hr: number;
  rbi: number;
  bb: number;
  k: number;
  sb: number;
  cs: number;
  hbp: number;
  sf: number;
  sac: number;
  e: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface PitchingSeasonLine {
  player_id: number;
  name: string;
  gp: number;
  ip: string | number;
  h: number;
  r: number;
  er: number;
  bb: number;
  k: number;
  hr: number;
  hbp: number;
  wp: number;
  bf: number;
  w: number;
  l: number;
  sv: number;
  pitches: number;
  strikes: number;
  era: number;
  whip: number;
}

export interface StatsResponse {
  players: ApiPlayer[];
  games: ApiGame[];
  batting: BattingSeasonLine[];
  pitching: PitchingSeasonLine[];
}

// ---- /api/baseball/boxscore shapes ----
export interface ParsedBattingLine {
  player: string;
  jersey?: number | null;
  pos?: string | null;
  ab: number;
  r: number;
  h: number;
  '1b': number;
  '2b': number;
  '3b': number;
  hr: number;
  rbi: number;
  bb: number;
  k: number;
  sb: number;
  cs: number;
  hbp: number;
  sf: number;
  sac: number;
  e: number;
}

export interface ParsedPitchingLine {
  player: string;
  jersey?: number | null;
  pos?: string | null;
  ip: string | number;
  h: number;
  r: number;
  er: number;
  bb: number;
  k: number;
  hr: number;
  hbp: number;
  wp: number;
  bf: number;
  pitches: number;
  strikes: number;
  w: number;
  l: number;
  sv: number;
}

export interface ParsedGame {
  id: number | null;
  date: string;
  opponent: string;
  tournament?: string;
  venue?: string;
  result?: string;
  our_score?: number | null;
  opp_score?: number | null;
}

export interface UncertainMatch {
  player: string;
  jersey?: number | null;
  reason: string;
}

export interface BoxscoreResponse {
  game: ParsedGame;
  batting: ParsedBattingLine[];
  pitching: ParsedPitchingLine[];
  already_exists: boolean;
  uncertain?: UncertainMatch[];
}

// ---- Editable line rows used by the submit page grids ----
export interface EditableBattingLine {
  player: string;
  jersey: string; // '' = no jersey yet
  pos: string;
  ab: number;
  r: number;
  h: number;
  '1b': number;
  '2b': number;
  '3b': number;
  hr: number;
  rbi: number;
  bb: number;
  k: number;
  sb: number;
  cs: number;
  hbp: number;
  sf: number;
  sac: number;
  e: number;
}

export interface EditablePitchingLine {
  player: string;
  jersey: string; // '' = no jersey yet
  ip: string;
  h: number;
  r: number;
  er: number;
  bb: number;
  k: number;
  hr: number;
  hbp: number;
  wp: number;
  bf: number;
  pitches: number;
  strikes: number;
  w: number;
  l: number;
  sv: number;
}

// ---- GET /api/baseball/games/:id shapes ----
export interface GameLineBatting extends ParsedBattingLine {
  player_id: number;
}

export interface GameLinePitching extends ParsedPitchingLine {
  player_id: number;
}

export interface GameDetailResponse {
  game: ApiGame;
  batting: GameLineBatting[];
  pitching: GameLinePitching[];
}
