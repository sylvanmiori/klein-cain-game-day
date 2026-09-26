-- 4:13 Baseball box-score stats schema (D1 database: 413baseball-stats)
-- Apply with: wrangler d1 execute 413baseball-stats --file=cloudflare/baseball-schema.sql
--
-- Design notes:
-- - players grows over time: the confirm endpoint inserts unknown names
--   automatically (pos 'UT', grad_year NULL).
-- - batting_lines / pitching_lines use (game_id, player_id) composite keys.
--   Confirm uses REPLACEMENT semantics: DELETE lines for the game, then INSERT.
-- - IP is stored as baseball-decimal (e.g. 5.2 = 5 and 2/3 innings). The
--   /api/baseball/stats endpoint aggregates in thirds (outs) before converting.
-- - "1b", "2b" and "3b" are quoted because bare identifiers starting with a
--   digit are not valid SQL column names.
-- - players.jersey_number is filled in from box-score screenshots (the PG
--   roster has no jersey numbers) and is the primary key used to match
--   GameChanger's truncated player names to roster players.
-- - batting_lines.e is fielding errors committed while batting-side players
--   were in the field (GameChanger's "E:" line under the batting table).

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  pos TEXT,
  grad_year INTEGER,
  jersey_number INTEGER
);

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY,
  date TEXT,
  opponent TEXT,
  tournament TEXT,
  venue TEXT,
  result TEXT
);

CREATE TABLE IF NOT EXISTS batting_lines (
  game_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  ab INTEGER DEFAULT 0,
  r INTEGER DEFAULT 0,
  h INTEGER DEFAULT 0,
  "1b" INTEGER DEFAULT 0,
  "2b" INTEGER DEFAULT 0,
  "3b" INTEGER DEFAULT 0,
  hr INTEGER DEFAULT 0,
  rbi INTEGER DEFAULT 0,
  bb INTEGER DEFAULT 0,
  k INTEGER DEFAULT 0,
  sb INTEGER DEFAULT 0,
  cs INTEGER DEFAULT 0,
  hbp INTEGER DEFAULT 0,
  sf INTEGER DEFAULT 0,
  sac INTEGER DEFAULT 0,
  e INTEGER DEFAULT 0,
  PRIMARY KEY (game_id, player_id),
  FOREIGN KEY (game_id) REFERENCES games (id),
  FOREIGN KEY (player_id) REFERENCES players (id)
);

CREATE TABLE IF NOT EXISTS pitching_lines (
  game_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  ip REAL DEFAULT 0,
  h INTEGER DEFAULT 0,
  r INTEGER DEFAULT 0,
  er INTEGER DEFAULT 0,
  bb INTEGER DEFAULT 0,
  k INTEGER DEFAULT 0,
  hr INTEGER DEFAULT 0,
  hbp INTEGER DEFAULT 0,
  wp INTEGER DEFAULT 0,
  bf INTEGER DEFAULT 0,
  w INTEGER DEFAULT 0,
  l INTEGER DEFAULT 0,
  sv INTEGER DEFAULT 0,
  pitches INTEGER DEFAULT 0,
  strikes INTEGER DEFAULT 0,
  PRIMARY KEY (game_id, player_id),
  FOREIGN KEY (game_id) REFERENCES games (id),
  FOREIGN KEY (player_id) REFERENCES players (id)
);

CREATE INDEX IF NOT EXISTS idx_batting_lines_player ON batting_lines (player_id);
CREATE INDEX IF NOT EXISTS idx_pitching_lines_player ON pitching_lines (player_id);
CREATE INDEX IF NOT EXISTS idx_games_date ON games (date);
