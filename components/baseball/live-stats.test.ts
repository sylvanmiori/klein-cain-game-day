import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findSavedResult, normalizeOpponent } from './live-stats.ts';
import type { ApiGame, ScheduleGame } from './types.ts';

const scheduleGame: ScheduleGame = {
  id: 'pool-1',
  date: '2026-09-26',
  opponent: 'TSB',
};

const savedGame: ApiGame = {
  id: 1,
  date: '2026-09-26',
  opponent: 'TSB',
  result: 'W 7-5',
};

describe('normalizeOpponent', () => {
  it('ignores case, spacing, and punctuation', () => {
    assert.equal(normalizeOpponent('T.S.B.'), normalizeOpponent('t s b'));
  });
});

describe('findSavedResult', () => {
  it('matches a saved result by date and opponent', () => {
    assert.equal(
      findSavedResult(scheduleGame, [scheduleGame], [savedGame]),
      'W 7-5',
    );
  });

  it('does not attach a result using the date alone', () => {
    assert.equal(
      findSavedResult(
        scheduleGame,
        [scheduleGame],
        [{ ...savedGame, opponent: 'Another Team' }],
      ),
      null,
    );
  });

  it('rejects ambiguous same-day doubleheaders', () => {
    const second = { ...scheduleGame, id: 'pool-2' };
    assert.equal(
      findSavedResult(scheduleGame, [scheduleGame, second], [savedGame]),
      null,
    );
  });

  it('rejects duplicate saved games and blank results', () => {
    assert.equal(
      findSavedResult(
        scheduleGame,
        [scheduleGame],
        [savedGame, { ...savedGame, id: 2 }],
      ),
      null,
    );
    assert.equal(
      findSavedResult(
        scheduleGame,
        [scheduleGame],
        [{ ...savedGame, result: '  ' }],
      ),
      null,
    );
  });
});
