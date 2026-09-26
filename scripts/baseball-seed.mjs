#!/usr/bin/env node
/**
 * Prints SQL INSERT statements seeding the 4:13 Baseball roster into the
 * 413baseball-stats D1 database.
 *
 * Usage:
 *   node scripts/baseball-seed.mjs > /tmp/seed.sql
 *   wrangler d1 execute 413baseball-stats --file=/tmp/seed.sql
 *
 * Also wired as: npm run baseball:seed
 * Idempotent (INSERT OR IGNORE on the UNIQUE name column), so it is safe to
 * re-run after the confirm endpoint has grown the roster.
 */

const ROSTER = [
  ['Hayden Baker', 'SS', 2031],
  ['Teagan Barnes', 'RHP', 2030],
  ['Rick Delgadillo', '1B', 2030],
  ['Tyler Grisham', '2B', 2030],
  ['Ethan Hale', 'C', 2030],
  ['Caden Koehn', '2B', 2030],
  ['Jayden Lange', '3B', 2030],
  ['Elijah Layton', 'OF', 2030],
  ['Luke Layton', 'C', 2030],
  ['Landon Morris', 'SS', 2030],
  ['Bruce Novacek', 'OF', 2030],
  ['Hampton Travis', 'RHP', 2030],
  ['Weston Travis', 'RHP', 2030],
  ['Levi Vannoy', '3B', 2030],
  ['Grayson Yates', 'LHP', 2030],
];

const q = s => `'${String(s).replace(/'/g, "''")}'`;

for (const [name, pos, gradYear] of ROSTER) {
  console.log(
    `INSERT OR IGNORE INTO players (name, pos, grad_year) VALUES (${q(name)}, ${q(pos)}, ${gradYear});`,
  );
}
