import assert from 'node:assert/strict';
import test from 'node:test';
import { findMaxPrepsGameUrl, parseGameStats } from './sources.mjs';

const teamId = 'cain-team';
const column = (name, overallValue = '') => ({ name, overallValue });
const row = (values, href = '') => ({
  columns: values.map((value, index) => ({
    value,
    href: index === 1 ? href : null,
  })),
});
const table = (name, columns, rows) => ({ name, stats: { columns, rows } });
const html = (value) => {
  const stream = `0:{"statsByTeamId":${JSON.stringify(value)}}`;
  return `<script>self.__next_f.push([1,${JSON.stringify(stream)}])</script>`;
};

const fixture = {
  [teamId]: {
    lastUpdated: { timeStamp: '2026-09-05T10:59:41' },
    groups: [
      {
        subgroups: [
          table(
            'Passing',
            [
              column('Jersey'),
              column('Name'),
              column('PassingComp', 10),
              column('PassingAtt', 18),
              column('PassingYards', 151),
              column('PassingTD', 2),
            ],
            [
              row(
                ['5', 'T. Reyes', '5', '5', '80', '1'],
                'https://www.maxpreps.com/tx/foo/athletes/trey-reyes/?careerid=x',
              ),
              row(
                ['9', 'J. Hanks', '5', '13', '71', '1'],
                'https://www.maxpreps.com/tx/foo/athletes/jace-hanks/?careerid=y',
              ),
            ],
          ),
          table(
            'Rushing',
            [
              column('Jersey'),
              column('Name'),
              column('RushingNum', 36),
              column('RushingYards', 303),
              column('RushingTDNum', 4),
            ],
            [
              row(
                ['9', 'J. Hanks', '12', '104', '0'],
                'https://www.maxpreps.com/tx/foo/athletes/jace-hanks/?careerid=y',
              ),
            ],
          ),
          table(
            'Receiving',
            [
              column('Jersey'),
              column('Name'),
              column('ReceivingNum', 10),
              column('ReceivingYards', 151),
              column('ReceivingTDNum', 2),
            ],
            [
              row(
                ['8', 'I. Smith', '4', '46', '1'],
                'https://www.maxpreps.com/tx/foo/athletes/israel-smith/?careerid=z',
              ),
            ],
          ),
          table(
            'Tackles',
            [
              column('Jersey'),
              column('Name'),
              column('Tackles', 47),
              column('Assists', 32),
              column('TotalTackles', 79),
              column('TacklesForLoss', 7),
            ],
            [
              row(
                ['47', 'E. Mizell', '8', '4', '12', '0'],
                'https://www.maxpreps.com/tx/foo/athletes/easton-mizell/?careerid=a',
              ),
            ],
          ),
          table('Defensive Statistics', [column('Jersey'), column('Name')], []),
          table(
            'Punts',
            [
              column('Jersey'),
              column('Name'),
              column('PuntNum', 3),
              column('PuntAverage', '38.0'),
              column('PuntLong', 42),
            ],
            [],
          ),
          table(
            'PATs and Field Goals',
            [
              column('Jersey'),
              column('Name'),
              column('PATKickingMade', 6),
              column('PATKickingAtt', 6),
              column('FGMade', 1),
              column('FGAttempted', 1),
              column('TotalKickingPoints', 9),
            ],
            [
              row(
                ['4', 'S. DesAutels', '6', '6', '1', '1', '9'],
                'https://www.maxpreps.com/tx/foo/athletes/sage-desautels/?careerid=b',
              ),
            ],
          ),
        ],
      },
    ],
  },
};

test('finds a game by exact schedule date', () => {
  const page =
    '<a href="https://www.maxpreps.com/tx/football/game/a-vs-b/9-4-2026/?c=abc-def">Game</a>';
  assert.equal(
    findMaxPrepsGameUrl(page, '2026-09-04'),
    'https://www.maxpreps.com/tx/football/game/a-vs-b/9-4-2026/?c=abc-def',
  );
  assert.equal(findMaxPrepsGameUrl(page, '2026-09-18'), null);
});

test('parses game-only team totals and category leaders', () => {
  const parsed = parseGameStats(html(fixture), {
    teamId,
    teamName: 'Klein Cain',
    roster: [{ number: 5, name: 'Trey Reyes' }],
  });
  assert.equal(parsed.team, 'Klein Cain');
  assert.equal(parsed.updated, '2026-09-05T10:59:41');
  assert.deepEqual(parsed.totals[0], {
    label: 'Total offense',
    value: '454 yards',
    detail: '151 passing · 303 rushing',
  });
  assert.deepEqual(parsed.leaders[0], {
    category: 'Passing',
    name: 'Trey Reyes',
    number: '5',
    stat: '80 passing yards',
    detail: '5 of 5 · 1 TD',
  });
  assert.equal(
    parsed.leaders.find((leader) => leader.category === 'Tackles').name,
    'Easton Mizell',
  );
  assert.deepEqual(parsed.playerOfGame, {
    name: 'Jace Hanks',
    number: '9',
    headline: '175 yards of offense · 1 TD',
    rationale: 'Hanks finished with 71 passing yards and 1 passing touchdown, and 104 rushing yards.',
    model: 'Cain Impact v1',
  });
});

test('treats a missing team stat block as unavailable, not zero', () => {
  assert.equal(
    parseGameStats(html({ [teamId]: null }), {
      teamId,
      teamName: 'Klein Cain',
    }),
    null,
  );
});
