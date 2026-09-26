/**
 * Post-process GameChanger box-score parses to strip roster-dump filler.
 * Llama often pads the candidate roster with clone stats (AB 2, R 1, H 1)
 * and invented sequential jerseys when D1 has no jersey map. Prefer this
 * filter over inflating the vision prompt.
 */

/** Jerseys corroborated from GameChanger photos for 4:13 (do not invent). */
export const TRUSTED_JERSEYS = new Set([42, 66, 2, 27, 7, 8, 9, 67, 6, 13, 23]);

const toInt = v => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

const toJersey = v => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function sumStat(rows, field) {
  let total = 0;
  for (const row of rows ?? []) total += toInt(row?.[field]);
  return total;
}

function lastNameKey(player) {
  const s = String(player ?? '').trim();
  if (!s) return '';
  const parts = s.split(/\s+/);
  return (parts[parts.length - 1] || s).toLowerCase();
}

/** Classic Llama filler signature: AB 2 or 3, exactly one run and one hit. */
export function isCloneBatRow(row) {
  const ab = toInt(row?.ab);
  const r = toInt(row?.r);
  const h = toInt(row?.h);
  return r === 1 && h === 1 && (ab === 2 || ab === 3);
}

function batKeepScore(row, pitchLastNames) {
  let s = 0;
  const j = toJersey(row?.jersey);
  if (j != null && TRUSTED_JERSEYS.has(j)) s += 5;
  if (pitchLastNames.has(lastNameKey(row?.player))) s += 4;
  if (!isCloneBatRow(row)) s += 3;
  if (toInt(row?.ab) !== 2) s += 1;
  if (toInt(row?.rbi) > 0 || toInt(row?.bb) > 0 || toInt(row?.k) > 0 || toInt(row?.sb) > 0) s += 2;
  if (toInt(row?.h) > 1 || toInt(row?.r) > 1) s += 2;
  return s;
}

/**
 * Drop roster-dump batting/pitching rows when sums disagree with the line
 * score or the batting table is suspiciously long.
 *
 * @returns {{ batting: object[], pitching: object[], meta: object }}
 */
export function filterRosterDump(batting, pitching, ourScore, oppScore) {
  let bats = Array.isArray(batting) ? batting.slice() : [];
  let pits = Array.isArray(pitching) ? pitching.slice() : [];
  const droppedBat = [];
  const droppedPit = [];
  const pitchLastNames = new Set(pits.map(p => lastNameKey(p.player)));

  const batRuns = () => sumStat(bats, 'r');
  const needsBat = (ourScore != null && bats.length > 0 && batRuns() !== ourScore)
    || bats.length > 11;

  if (needsBat && bats.length > 0) {
    // Pass 1: drop untrusted clone-template rows while sum(r) is too high
    // or the lineup is still longer than a normal GameChanger table.
    const tryDrop = (predicate) => {
      // Recompute ranks each pass; drop one at a time from worst keep-score.
      for (;;) {
        const runs = batRuns();
        const tooLong = bats.length > 11;
        const tooManyRuns = ourScore != null && runs > ourScore;
        if (!tooLong && !tooManyRuns) break;
        if (ourScore != null && runs < ourScore && !tooLong) break;

        let worstIdx = -1;
        let worstScore = Infinity;
        for (let i = 0; i < bats.length; i++) {
          const row = bats[i];
          if (!predicate(row)) continue;
          const score = batKeepScore(row, pitchLastNames);
          // Prefer dropping later (often appended fillers) on ties.
          if (score < worstScore || (score === worstScore && i > worstIdx)) {
            worstScore = score;
            worstIdx = i;
          }
        }
        if (worstIdx < 0) break;
        const row = bats[worstIdx];
        const rowR = toInt(row.r);
        // Never undershoot our_score just to shorten — unless row contributes 0 runs.
        if (ourScore != null && tooManyRuns && runs - rowR < ourScore && rowR > 0) {
          // Skip this row for now; mark so we don't infinite-loop.
          // Temporarily exclude by failing predicate via tagging.
          row.__skipDrop = true;
          continue;
        }
        droppedBat.push({ player: row.player, jersey: row.jersey, ab: row.ab, r: row.r, h: row.h });
        bats.splice(worstIdx, 1);
      }
      for (const row of bats) delete row.__skipDrop;
    };

    tryDrop(row => !row.__skipDrop && isCloneBatRow(row) && !TRUSTED_JERSEYS.has(toJersey(row.jersey)));
    tryDrop(row => {
      if (row.__skipDrop) return false;
      const j = toJersey(row.jersey);
      const untrusted = j == null || !TRUSTED_JERSEYS.has(j);
      return untrusted && batKeepScore(row, pitchLastNames) < 5;
    });

    // If still too long with matching sum, drop r=0 untrusted filler only.
    while (bats.length > 11) {
      let idx = -1;
      let worst = Infinity;
      for (let i = 0; i < bats.length; i++) {
        const row = bats[i];
        const j = toJersey(row.jersey);
        if (TRUSTED_JERSEYS.has(j)) continue;
        if (toInt(row.r) !== 0) continue;
        const score = batKeepScore(row, pitchLastNames);
        if (score < worst) {
          worst = score;
          idx = i;
        }
      }
      if (idx < 0) break;
      const row = bats[idx];
      droppedBat.push({ player: row.player, jersey: row.jersey, ab: row.ab, r: row.r, h: row.h });
      bats.splice(idx, 1);
    }
  }

  const pitScore = row => {
    let s = 0;
    const j = toJersey(row?.jersey);
    if (j != null && TRUSTED_JERSEYS.has(j)) s += 4;
    s += Number(row?.ip) || 0;
    if (toInt(row?.w) || toInt(row?.l) || toInt(row?.sv)) s += 3;
    return s;
  };

  // Pitching: when sum(r) > opp_score, drop lowest-value extras.
  if (oppScore != null && pits.length > 1 && sumStat(pits, 'r') > oppScore) {
    for (;;) {
      const runs = sumStat(pits, 'r');
      if (runs <= oppScore) break;
      let worstIdx = -1;
      let worst = Infinity;
      for (let i = 0; i < pits.length; i++) {
        const row = pits[i];
        const j = toJersey(row.jersey);
        if (j != null && TRUSTED_JERSEYS.has(j) && pits.length <= 2) continue;
        const score = pitScore(row);
        if (score < worst || (score === worst && i > worstIdx)) {
          worst = score;
          worstIdx = i;
        }
      }
      if (worstIdx < 0) break;
      const row = pits[worstIdx];
      const rowR = toInt(row.r);
      if (runs - rowR < oppScore && rowR > 0) break;
      droppedPit.push({ player: row.player, jersey: row.jersey, ip: row.ip, r: row.r });
      pits.splice(worstIdx, 1);
      if (pits.length <= 1) break;
    }
  }

  // Drop untrusted zero-R pitching fillers when a trusted pitcher already
  // accounts for the opp runs (common roster-dump: Delgadillo 0 R after Lange).
  if (pits.length > 1) {
    const hasTrusted = pits.some(p => TRUSTED_JERSEYS.has(toJersey(p.jersey)));
    if (hasTrusted) {
      pits = pits.filter(row => {
        const j = toJersey(row.jersey);
        const untrusted = j == null || !TRUSTED_JERSEYS.has(j);
        if (untrusted && toInt(row.r) === 0 && !(toInt(row.w) || toInt(row.l) || toInt(row.sv))) {
          droppedPit.push({ player: row.player, jersey: row.jersey, ip: row.ip, r: row.r });
          return false;
        }
        return true;
      });
    }
  }

  return {
    batting: bats,
    pitching: pits,
    meta: {
      dropped_batting: droppedBat,
      dropped_pitching: droppedPit,
      batting_runs_after: sumStat(bats, 'r'),
      pitching_runs_after: sumStat(pits, 'r'),
    },
  };
}

/**
 * Choose between first vision parse and optional audit parse.
 * Prefer strictly better sum-check; on a tie prefer fewer batting rows
 * (anti-roster-dump). Never prefer a longer dump when sums are equally bad.
 */
export function preferBoxscoreParse(first, firstCheck, audited, secondCheck) {
  if (!audited) return { parsed: first, reason: 'no_audit' };
  const firstBad = firstCheck?.issues?.length ?? 99;
  const secondBad = secondCheck?.issues?.length ?? 99;
  if (secondBad < firstBad) return { parsed: audited, reason: 'audit_fewer_issues' };
  if (secondBad > firstBad) return { parsed: first, reason: 'keep_first_better_sums' };
  const len1 = Array.isArray(first?.batting) ? first.batting.length : 0;
  const len2 = Array.isArray(audited?.batting) ? audited.batting.length : 0;
  if (len2 < len1) return { parsed: audited, reason: 'audit_shorter_lineup' };
  return { parsed: first, reason: 'keep_first_tie' };
}
