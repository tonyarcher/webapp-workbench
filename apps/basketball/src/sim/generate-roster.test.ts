import {describe, expect, it} from 'vitest';
import {mulberry32} from './rng';
import {generateMatchup, generateSide} from './generate-roster';

describe('generate-roster', () => {
    it('builds unique names and twelve players', () => {
        const side = generateSide(mulberry32(3), 'home', 'Harbor');
        expect(side.roster).toHaveLength(12);
        expect(new Set(side.roster.map((p) => p.name)).size).toBe(12);
        expect(new Set(side.roster.map((p) => p.jersey)).size).toBe(12);
        expect(Object.keys(side.ratings)).toHaveLength(12);
    });

    it('picks two different team names', () => {
        const matchup = generateMatchup(mulberry32(1));
        expect(matchup.home.teamName).not.toBe(matchup.away.teamName);
        const same = generateMatchup(() => 0);
        expect(same.home.teamName).not.toBe(same.away.teamName);
    });

    it('falls back when names collide', () => {
        const side = generateSide(() => 0, 'away', 'Same');
        expect(side.roster.some((player) => player.name.startsWith('Player'))).toBe(true);
    });
});
