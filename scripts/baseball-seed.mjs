#!/usr/bin/env node
/**
 * Prints SQL statements seeding the 4:13 Baseball roster into the
 * 413baseball-stats D1 database.
 *
 * Usage:
 *   node scripts/baseball-seed.mjs > /tmp/seed.sql
 *   wrangler d1 execute 413baseball-stats --remote --file=/tmp/seed.sql
 *
 * Also wired as: npm run baseball:seed
 * Idempotent INSERT OR IGNORE on the UNIQUE name column. Jersey UPDATEs only
 * set numbers corroborated from GameChanger photos — never invent for players
 * who have not appeared with a visible #NN.
 */

/** [name, pos, gradYear, jerseyNumber|null] */
const ROSTER = [
  ['Hayden Baker', 'SS', 2031, null],
  ['Teagan Barnes', 'RHP', 2030, 27],
  ['Rick Delgadillo', '1B', 2030, null],
  ['Tyler Grisham', '2B', 2030, 6],
  ['Ethan Hale', 'C', 2030, 67],
  ['Caden Koehn', '2B', 2030, 9],
  ['Jayden Lange', '3B', 2030, 23],
  ['Elijah Layton', 'OF', 2030, null],
  ['Luke Layton', 'C', 2030, 2],
  ['Landon Morris', 'SS', 2030, 42],
  ['Bruce Novacek', 'OF', 2030, 8],
  ['Hampton Travis', 'RHP', 2030, 7],
  ['Weston Travis', 'RHP', 2030, 13],
  ['Levi Vannoy', '3B', 2030, 66],
  ['Grayson Yates', 'LHP', 2030, null],
];

const q = s => `'${String(s).replace(/'/g, "''")}'`;

for (const [name, pos, gradYear] of ROSTER) {
  console.log(
    `INSERT OR IGNORE INTO players (name, pos, grad_year) VALUES (${q(name)}, ${q(pos)}, ${gradYear});`,
  );
}

for (const [name, , , jersey] of ROSTER) {
  if (jersey == null) continue;
  console.log(
    `UPDATE players SET jersey_number = ${jersey} WHERE name = ${q(name)} AND (jersey_number IS NULL OR jersey_number != ${jersey});`,
  );
}
