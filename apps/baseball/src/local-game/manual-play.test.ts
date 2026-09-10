import { describe, expect, it } from 'vitest';
import { ManualPlayTracker } from './manual-play';

describe('ManualPlayTracker', () => {
  it('arms, applies, and clears a pitch location', () => {
    const tracker = new ManualPlayTracker();
    tracker.arm(7);
    expect(tracker.zone).toBe(7);
    expect(tracker.apply({ eventType: 'STRIKE' })).toEqual({
      eventType: 'STRIKE',
      pitchLocation: { zone: 7 },
    });
    expect(tracker.zone).toBe(0);
    expect(tracker.apply({ eventType: 'BALL' })).toEqual({ eventType: 'BALL' });
  });

  it('rejects out-of-range or malformed zones', () => {
    const tracker = new ManualPlayTracker();
    tracker.arm(12);
    expect(tracker.zone).toBe(0);
    tracker.arm('nope');
    expect(tracker.zone).toBe(0);
    tracker.arm(9);
    expect(tracker.zone).toBe(9);
  });

  it('remembers events and syncs to the visible history', () => {
    const tracker = new ManualPlayTracker();
    tracker.remember('STRIKE', { pitchLocation: { zone: 3 } }, null);
    expect(tracker.playSeq).toBe(1);
    expect(JSON.parse(tracker.playJson)).toMatchObject({ eventType: 'STRIKE', seq: 1 });

    tracker.syncTo(null);
    expect(tracker.playJson).toBe('');

    tracker.reset();
    expect(tracker.playSeq).toBe(0);
  });
});
