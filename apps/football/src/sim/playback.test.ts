import {describe, expect, it} from 'vitest';
import {delayForPlay} from './playback';
import {highlightLabel} from './watch-runner';

describe('playback', () => {
    it('holds a scrimmage about four seconds at 1x with animations', () => {
        expect(delayForPlay('scrimmage', 1, true)).toBeGreaterThanOrEqual(4000);
    });
});

describe('highlightLabel', () => {
    it('maps a complete pass to the Complete button', () => {
        expect(highlightLabel({
            type: 'play',
            input: {
                family: 'scrimmage',
                concept: 'dropback',
                snapClock: 700,
                deadClock: 680,
                yards: 12,
            },
        })).toBe('Complete');
    });

    it('maps FG good', () => {
        expect(highlightLabel({
            type: 'play',
            input: {
                family: 'field_goal',
                snapClock: 700,
                deadClock: 694,
                fieldGoalMade: true,
            },
        })).toBe('FG good');
    });
});
