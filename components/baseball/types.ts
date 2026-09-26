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
  notes?: string;
  pgUrl?: string;
  bracketUrl?: string;
}

export interface BaseballSchedule {
  tournaments: ScheduleTournament[];
  games: ScheduleGame[];
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
  id: string;
  name: string;
  pos: string;
  grad_year: number;
}

export interface ApiGame {
  id: string;
  date: string;
  opponent: string;
  tournament?: string;
  venue?: string;
  result?: string | null;
}

export interface BattingSeasonLine {
  player_id: string;
  name: string;
  gp: number;
  ab: number;
  r: number;
  h: number;
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
  avg: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface PitchingSeasonLine {
  player_id: string;
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
  ab: number;
  r: number;
  h: number;
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
}

export interface ParsedPitchingLine {
  player: string;
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
  w: number;
  l: number;
  sv: number;
}

export interface ParsedGame {
  id: string | null;
  date: string;
  opponent: string;
  tournament?: string;
  venue?: string;
  result?: string;
}

export interface BoxscoreResponse {
  game: ParsedGame;
  batting: ParsedBattingLine[];
  pitching: ParsedPitchingLine[];
  already_exists: boolean;
}
