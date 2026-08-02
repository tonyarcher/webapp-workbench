import { describe, expect, it } from 'vitest';
import { hitBaseCount, hitNotation, inPlayOutNotation } from './notation';

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

  it('falls back to generic notation without a position', () => {
    expect(inPlayOutNotation('GROUNDOUT')).toBe('GO');
    expect(inPlayOutNotation('FLYOUT')).toBe('FO');
    expect(inPlayOutNotation('LINE_OUT')).toBe('LO');
    expect(inPlayOutNotation('POP_OUT')).toBe('PO');
    expect(inPlayOutNotation('SACRIFICE_FLY')).toBe('SF');
  });
});
