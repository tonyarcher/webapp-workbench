import {describe, expect, it} from 'vitest';
import {generateRoster} from './default-roster';
import {applySub, isOnCourt, isValidOnCourt, startersOf} from './lineup';

describe('lineup', () => {
    const roster = generateRoster('home');

    it('starts the first five', () => {
        const onCourt = startersOf(roster);
        expect(onCourt).toHaveLength(5);
        expect(isValidOnCourt(onCourt, roster)).toBe(true);
        expect(isOnCourt(onCourt, onCourt[0] ?? '')).toBe(true);
    });

    it('rejects a sixth starter or a duplicate', () => {
        const onCourt = startersOf(roster);
        expect(isValidOnCourt([...onCourt, 'home-3'], roster)).toBe(false);
        expect(isValidOnCourt([onCourt[0] ?? '', onCourt[0] ?? '', 'a', 'b', 'c'], roster)).toBe(false);
        expect(isValidOnCourt(['nope', 'x', 'y', 'z', 'q'], roster)).toBe(false);
    });

    it('subs one for one', () => {
        const onCourt = startersOf(roster);
        const outId = onCourt[0] ?? '';
        const inId = roster[5]?.id ?? '';
        expect(applySub(onCourt, outId, inId)?.includes(inId)).toBe(true);
        expect(applySub(onCourt, outId, outId)).toBeNull();
        expect(applySub(onCourt, inId, outId)).toBeNull();
        expect(applySub(onCourt, outId, onCourt[1] ?? '')).toBeNull();
    });
});
