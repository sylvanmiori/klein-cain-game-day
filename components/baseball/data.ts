// Server-side data helpers for the 4:13 Baseball subsite.
// Static JSON lives in content/baseball/ (maintained by the schedule/bracket
// scraper workflows); the worker owns the /api/baseball/* endpoints these
// pages call at runtime.

import scheduleJson from '../../content/baseball/schedule.json';
import bracketJson from '../../content/baseball/bracket.json';
import type { BaseballBracket, BaseballSchedule, BracketGame, RosterPlayer, ScheduleGame, ScheduleTournament } from './types';

// ---- Raw scraper shapes ----
interface RawScheduleGame {
  date: string;
  time?: string;
  opponent: string;
  opponent_record?: string;
  home_away?: string;
  pool?: string;
  field?: string;
  venue?: string;
  result?: string | null;
  diamondkast_url?: string;
}

interface RawScheduleTournament {
  name: string;
  dates?: string;
  start_date?: string;
  end_date?: string;
  city?: string;
  venue?: string;
  event_url?: string;
  bracket_url?: string;
  games?: RawScheduleGame[];
}

interface RawBracketGame {
  tier?: string;
  round?: string;
  matchup?: string;
  date?: string;
  time?: string;
  field?: string;
  venue?: string;
}

function normalizeGame(raw: RawScheduleGame, tournamentId: string, index: number): ScheduleGame {
  const ha = (raw.home_away ?? '').trim().toLowerCase();
  return {
    id: `${tournamentId}-g${index}`,
    date: raw.date,
    time: raw.time,
    opponent: raw.opponent,
    opponentRecord: raw.opponent_record,
    homeAway: ha === '@' ? 'away' : ha === 'vs' ? 'home' : 'neutral',
    tournamentId,
    venue: raw.venue,
    field: raw.field,
    note: raw.pool ? `Pool ${raw.pool}` : undefined,
    result: raw.result ?? null,
    diamondkastUrl: raw.diamondkast_url,
  };
}

export function loadSchedule(): BaseballSchedule | null {
  const raw = scheduleJson as unknown as { tournaments?: RawScheduleTournament[] };
  if (!raw || !Array.isArray(raw.tournaments)) return null;
  const tournaments: ScheduleTournament[] = raw.tournaments.map((t, i) => ({
    id: `t${i}`,
    name: t.name,
    dates: t.dates ?? [t.start_date, t.end_date].filter(Boolean).join(' – '),
    startDate: t.start_date,
    endDate: t.end_date,
    venue: t.venue,
    location: t.city,
    pgUrl: t.event_url,
    bracketUrl: t.bracket_url,
  }));
  const games: ScheduleGame[] = raw.tournaments.flatMap((t, i) =>
    (Array.isArray(t.games) ? t.games : []).map((g, j) => normalizeGame(g, `t${i}`, j)),
  );
  return { tournaments, games };
}

export function loadBracket(): BaseballBracket | null {
  const raw = bracketJson as unknown as {
    tournament?: string;
    tournamentName?: string;
    bracket_url?: string;
    bracketUrl?: string;
    scraped_at?: string;
    updated?: string;
    games?: RawBracketGame[];
  };
  if (!raw || !Array.isArray(raw.games)) return null;
  const games: BracketGame[] = raw.games
    .filter((g) => g && typeof g.matchup === 'string' && typeof g.round === 'string')
    .map((g) => ({
      tier: g.tier,
      round: g.round as string,
      matchup: g.matchup as string,
      date: g.date,
      time: g.time,
      field: g.field,
      venue: g.venue,
    }));
  return {
    tournamentName: raw.tournamentName ?? raw.tournament,
    bracketUrl: raw.bracketUrl ?? raw.bracket_url,
    updated: raw.updated ?? raw.scraped_at,
    games,
  };
}

function todayStr(tz = 'America/Chicago'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export interface WeekendWindow {
  tournament: ScheduleTournament | null;
  games: ScheduleGame[];
}

/** Pick the tournament to feature as "this weekend": the one running today,
 *  otherwise the next upcoming one, otherwise the most recent. */
export function currentWeekend(schedule: BaseballSchedule, today = todayStr()): WeekendWindow {
  const ts = schedule.tournaments;
  if (ts.length === 0) return { tournament: null, games: [] };
  const running = ts.find((t) => t.startDate && t.endDate && t.startDate <= today && today <= t.endDate);
  const upcoming = ts
    .filter((t) => (t.startDate ?? '') > today)
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))[0];
  const recent = [...ts].sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''))[0];
  const tournament = running ?? upcoming ?? recent;
  const games = [...schedule.games]
    .filter((g) => g.tournamentId === tournament.id)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
  return { tournament, games };
}

/** "Sat, Sep 26" from a YYYY-MM-DD date without timezone shift. */
export function formatGameDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Roster, verified against the Perfect Game team page (2026-09-26).
// Grad years: Hayden Baker 2031, everyone else 2030.
export const BASEBALL_ROSTER: RosterPlayer[] = [
  { name: 'Hayden Baker', pos: 'SS', gradYear: 2031, bt: 'R/R', ht: '6-0', wt: '150', hometown: 'Cypress, TX' },
  { name: 'Teagan Barnes', pos: 'RHP', gradYear: 2030, bt: 'R/R', ht: '5-10', wt: '155', hs: 'Klein Oak', hometown: 'Spring, TX' },
  { name: 'Rick Delgadillo', pos: '1B', gradYear: 2030, bt: 'R/R', ht: '6-1', wt: '230', hs: 'Klein Cain', hometown: 'Houston, TX' },
  { name: 'Tyler Grisham', pos: '2B', gradYear: 2030, bt: 'R/R', ht: '3-11', wt: '62', hometown: 'Tomball, TX' },
  { name: 'Ethan Hale', pos: 'C', gradYear: 2030, bt: 'R/R', ht: '4-10', wt: '87', hometown: 'Houston, TX' },
  { name: 'Caden Koehn', pos: '2B', gradYear: 2030, bt: 'R/R', ht: '5-2', wt: '110', hometown: 'Cypress, TX' },
  { name: 'Jayden Lange', pos: '3B', gradYear: 2030, bt: 'R/R', ht: '6-0', wt: '150', hs: 'Klein', hometown: 'Tomball, TX' },
  { name: 'Elijah Layton', pos: 'OF', gradYear: 2030, bt: 'R/R', ht: '5-7', wt: '119', hs: 'Klein Cain', hometown: 'Tomball, TX' },
  { name: 'Luke Layton', pos: 'C', gradYear: 2030, bt: 'R/R', ht: '5-11', wt: '168', hs: 'Klein Cain', hometown: 'Tomball, TX' },
  { name: 'Landon Morris', pos: 'SS', gradYear: 2030, bt: 'R/R', ht: '5-9', wt: '142', hs: 'Klein Cain', hometown: 'Spring, TX' },
  { name: 'Bruce Novacek', pos: 'OF', gradYear: 2030, bt: 'L/L', ht: '5-0', wt: '96', hometown: 'Houston, TX' },
  { name: 'Hampton Travis', pos: 'RHP', gradYear: 2030, bt: 'R/R', ht: '5-0', wt: '100', hometown: 'Spring, TX' },
  { name: 'Weston Travis', pos: 'RHP', gradYear: 2030, bt: 'R/R', ht: '5-0', wt: '100', hometown: 'Spring, TX' },
  { name: 'Levi Vannoy', pos: '3B', gradYear: 2030, bt: 'R/R', ht: '6-0', wt: '165', hs: 'Klein Cain', hometown: 'Spring, TX' },
  { name: 'Grayson Yates', pos: 'LHP', gradYear: 2030, bt: 'L/L', ht: '5-5', wt: '115', hs: 'Cypress Ranch', hometown: 'Cypress, TX' },
];
