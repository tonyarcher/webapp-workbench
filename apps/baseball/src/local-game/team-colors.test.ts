import { describe, expect, it } from 'vitest';
import { teamPrimaryColor } from './team-colors';

describe('teamPrimaryColor', () => {
  it('returns the mapped color for known teams', () => {
    expect(teamPrimaryColor('Chicago Cubs')).toBe('#1d4ed8');
    expect(teamPrimaryColor('St. Louis Cardinals')).toBe('#c8102e');
    expect(teamPrimaryColor('Portland Pickles')).toBe('#2f9e44');
  });

  it('derives a stable hue for unknown teams', () => {
    const first = teamPrimaryColor('Unknown Nine');
    expect(first).toMatch(/^hsl\(\d+ 78% 58%\)$/);
    expect(teamPrimaryColor('Unknown Nine')).toBe(first);
    expect(teamPrimaryColor('Other Nine')).not.toBe(first);
  });
});
