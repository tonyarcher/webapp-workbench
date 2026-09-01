import { describe, expect, it } from 'vitest';
import {
  hitBaseCount,
  hitNotation,
  inPlayOutNotation,
  runnerAdvancementsForHit,
  runnerAdvancementsForSacrifice,
  runnerAdvancementsForSteal,
  runnerAdvancementsForWalk,
} from './notation';

describe('hitBaseCount', () => {
  it('maps each hit type to its base count', () => {
    expect(hitBaseCount('SINGLE')).toBe(1);
    expect(hitBaseCount('DOUBLE')).toBe(2);
    expect(hitBaseCount('TRIPLE')).toBe(3);
    expect(hitBaseCount('HOME_RUN')).toBe(4);
    expect(hitBaseCount('BALL')).toBe(0);
  });
});

describe('hitNotation', () => {
  it('maps each hit type to its notation', () => {
    expect(hitNotation('SINGLE')).toBe('1B');
    expect(hitNotation('DOUBLE')).toBe('2B');
    expect(hitNotation('TRIPLE')).toBe('3B');
    expect(hitNotation('HOME_RUN')).toBe('HR');
    expect(hitNotation('BALL')).toBe('');
  });
});

describe('inPlayOutNotation', () => {
  it('uses position-based notation when a fielding position is given', () => {
    expect(inPlayOutNotation('GROUNDOUT', 6)).toBe('6-3');
    expect(inPlayOutNotation('GROUNDOUT', 3)).toBe('3');
    expect(inPlayOutNotation('FLYOUT', 8)).toBe('8');
    expect(inPlayOutNotation('LINE_OUT', 9)).toBe('L9');
    expect(inPlayOutNotation('POP_OUT', 6)).toBe('P6');
    expect(inPlayOutNotation('SACRIFICE_FLY', 8)).toBe('SF8');
  });

  it('uses the double-play sequence when a double play is flagged', () => {
    expect(inPlayOutNotation('GROUNDOUT', 6, true)).toBe('6-4-3');
    expect(inPlayOutNotation('LINE_OUT', 9, true)).toBe('L9-4-3');
    expect(inPlayOutNotation('GROUNDOUT', undefined, true)).toBe('GO-DP');
    expect(inPlayOutNotation('LINE_OUT', undefined, true)).toBe('LO-DP');
  });

  it('falls back to generic notation without a position', () => {
    expect(inPlayOutNotation('GROUNDOUT')).toBe('GO');
    expect(inPlayOutNotation('FLYOUT')).toBe('FO');
    expect(inPlayOutNotation('LINE_OUT')).toBe('LO');
    expect(inPlayOutNotation('POP_OUT')).toBe('PO');
    expect(inPlayOutNotation('SACRIFICE_FLY')).toBe('SF');
  });
});

describe('runnerAdvancementsForHit', () => {
  it('returns empty when there are no runners', () => {
    expect(runnerAdvancementsForHit([false, false, false], 1)).toEqual([]);
  });

  it('advances a runner from first to third on a double', () => {
    expect(runnerAdvancementsForHit([true, false, false], 2)).toEqual([{ from: 1, to: 3, scored: false }]);
  });

  it('scores runners whose destination passes home plate', () => {
    expect(runnerAdvancementsForHit([true, true, false], 3)).toEqual([
      { from: 1, to: 4, scored: true },
      { from: 2, to: 4, scored: true },
    ]);
  });
});

describe('runnerAdvancementsForWalk', () => {
  it('moves each runner up one base and scores the runner on third', () => {
    expect(runnerAdvancementsForWalk([true, true, true])).toEqual([
      { from: 1, to: 2, scored: false },
      { from: 2, to: 3, scored: false },
      { from: 3, to: 4, scored: true },
    ]);
  });
});

describe('runnerAdvancementsForSacrifice', () => {
  it('scores a runner from third on a sacrifice', () => {
    expect(runnerAdvancementsForSacrifice([false, false, true])).toEqual([{ from: 3, to: 4, scored: true }]);
  });

  it('returns empty when no runner is on third', () => {
    expect(runnerAdvancementsForSacrifice([true, false, false])).toEqual([]);
  });
});

describe('runnerAdvancementsForSteal', () => {
  it('marks a steal of second', () => {
    expect(runnerAdvancementsForSteal(1, 2)).toEqual([{ from: 1, to: 2, scored: false }]);
  });

  it('marks a steal of home as scored', () => {
    expect(runnerAdvancementsForSteal(3, 4)).toEqual([{ from: 3, to: 4, scored: true }]);
  });
});

describe('sacrifice bunt notation', () => {
  it('records SH with an optional fielder', () => {
    expect(inPlayOutNotation('SACRIFICE_BUNT')).toBe('SH');
    expect(inPlayOutNotation('SACRIFICE_BUNT', 1)).toBe('SH1');
  });
});
