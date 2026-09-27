/**
 * Machine-owned preview intro sidebar facts for upcoming editions.
 * Built only from season-data, edition records, prediction and coaches config.
 */

/** Short label for the school (e.g. Klein Cain → Cain). */
export function schoolShortLabel(schoolName) {
  const parts = String(schoolName || '').trim().split(/\s+/);
  return parts.length ? parts[parts.length - 1] : schoolName;
}

/** "9th season", "1st season", etc. */
export function ordinalSeason(season) {
  const n = Number(season);
  if (!Number.isFinite(n) || n < 1) return null;
  const mod100 = n % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? 'th'
      : n % 10 === 1
        ? 'st'
        : n % 10 === 2
          ? 'nd'
          : n % 10 === 3
            ? 'rd'
            : 'th';
  return `${n}${suffix} season`;
}

/** Points per game from verified Cain results in season-data. */
export function schoolPointsPerGame(results) {
  const rows = Object.values(results ?? {});
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + Number(row.us), 0);
  if (!Number.isFinite(total)) return null;
  return total / rows.length;
}

export function findStandingsRow(standings, name, mascot) {
  const key = `${name} ${mascot}`.trim();
  return standings?.rows?.find((row) => row.team === key) ?? null;
}

function teamFactValue({ overall, district, ppg }) {
  const parts = [];
  if (overall) parts.push(overall);
  if (district) parts.push(`${district} district`);
  if (ppg !== null && ppg !== undefined) parts.push(`${ppg.toFixed(1)} points/game`);
  return parts.length ? parts.join(' · ') : null;
}

function schoolSide(edition, schoolName) {
  return edition.home.name === schoolName ? 'home' : 'away';
}

/**
 * @param {{
 *   edition: object,
 *   publication: { schoolName: string },
 *   seasonData: { results?: object, standings?: { rows?: object[] } },
 *   coaches: { opponents?: Record<string, { name: string, season: number }> },
 *   opponentKey: string,
 * }} input
 */
export function buildPreviewIntroFacts({ edition, publication, seasonData, coaches, opponentKey }) {
  const facts = [];
  const schoolName = publication.schoolName;
  const schoolShort = schoolShortLabel(schoolName);
  const side = schoolSide(edition, schoolName);
  const oppSide = side === 'home' ? 'away' : 'home';
  const schoolTeam = edition[side];
  const oppTeam = edition[oppSide];

  const schoolRow = findStandingsRow(seasonData.standings, schoolTeam.name, schoolTeam.mascot);
  const oppRow = findStandingsRow(seasonData.standings, oppTeam.name, oppTeam.mascot);
  const schoolOverall = schoolTeam.record || schoolRow?.overall || null;
  const oppOverall = oppTeam.record || oppRow?.overall || null;
  const ppg = schoolPointsPerGame(seasonData.results);

  const schoolValue = teamFactValue({
    overall: schoolOverall,
    district: schoolRow?.district ?? null,
    ppg,
  });
  if (schoolValue) {
    facts.push({ label: schoolShort, value: schoolValue, team: 'school' });
  }

  const oppValue = teamFactValue({
    overall: oppOverall,
    district: oppRow?.district ?? null,
    ppg: null,
  });
  if (oppValue) {
    facts.push({ label: opponentKey, value: oppValue, team: 'opponent' });
  }

  const rawMargin = edition.prediction?.margin;
  if (Number.isFinite(rawMargin)) {
    const margin = Math.round(rawMargin);
    if (margin !== 0) {
      const schoolFavored = margin > 0;
      const winner = schoolFavored ? schoolShort : opponentKey;
      facts.push({
        label: 'Pick',
        value: `${winner} by ${Math.abs(margin)}`,
        team: schoolFavored ? 'school' : 'opponent',
      });
    }
  }

  const coach = coaches.opponents?.[opponentKey];
  const seasonLabel = coach ? ordinalSeason(coach.season) : null;
  if (coach?.name && seasonLabel) {
    facts.push({
      label: `${opponentKey} coach`,
      value: `${coach.name} · ${seasonLabel}`,
      team: 'opponent',
    });
  }

  return facts;
}
