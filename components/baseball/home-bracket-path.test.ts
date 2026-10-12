import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { eliminationLabel } from './live-bracket.ts';
import type { LiveBracketGame } from './types.ts';

describe('eliminationLabel', () => {
  it('reports SF #42 when 4:13 loses the semifinal', () => {
    const path: LiveBracketGame[] = [
      {
        game_number: 39,
        round: 'Quarterfinal',
        home: { name: '4:13 Baseball', score: 9 },
        away: { name: 'AMP Academy - 15u', score: 8 },
        winner: 'home',
      },
      {
        game_number: 42,
        round: 'Semifinal',
        home: { name: '4:13 Baseball', score: 8 },
        away: { name: 'Canes Houston - 15U', score: 9 },
        winner: 'away',
      },
    ];
    assert.equal(eliminationLabel(path), 'SF #42');
  });
});
