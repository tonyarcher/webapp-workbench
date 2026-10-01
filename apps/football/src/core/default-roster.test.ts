import { describe, expect, it } from 'vitest';
import { generateRoster, isValidPersonnel, personnelFromRosters } from './default-roster';

describe('generateRoster', () => {
    it('fills all three units for either team', () => {
        for (const team of ['home', 'away'] as const) {
            const roster = generateRoster(team);
            expect(roster.filter((p) => p.unit === 'offense')).toHaveLength(11);
            expect(roster.filter((p) => p.unit === 'defense')).toHaveLength(11);
            expect(roster.filter((p) => p.unit === 'special')).toHaveLength(3);
        }
    });

    it('scopes ids to the team but leaves the display name unqualified', () => {
        const home = generateRoster('home');
        const away = generateRoster('away');

        expect(home.map((p) => p.id)).toEqual(away.map((p) => p.id.replace(/^away-/, 'home-')));
        expect(home[0]).toMatchObject({ id: 'home-9-QB', name: 'QB 9', jersey: 9 });
        expect(away[0]).toMatchObject({ id: 'away-9-QB', name: 'QB 9' });
    });
});

describe('personnelFromRosters', () => {
    it('takes eleven per side and leaves the specialists off', () => {
        const roster = generateRoster('home');
        const personnel = personnelFromRosters(roster, roster);

        expect(personnel.offense).toHaveLength(11);
        expect(personnel.defense).toHaveLength(11);
        expect(personnel.grouping).toBe('11');
        expect(personnel.offense).not.toContain(roster.find((p) => p.position === 'K')?.id);
        expect(personnel.defense).not.toContain(roster.find((p) => p.position === 'P')?.id);
    });

    it('reads the two sides independently', () => {
        const offense = generateRoster('home').filter((p) => p.unit === 'offense');
        const defense = generateRoster('away').filter((p) => p.unit === 'defense');
        const personnel = personnelFromRosters(offense, defense);

        expect(personnel.offense.every((id) => id.startsWith('home-'))).toBe(true);
        expect(personnel.defense.every((id) => id.startsWith('away-'))).toBe(true);
    });

    it('selects by unit rather than by position in the roster', () => {
        const roster = generateRoster('home');
        const specialists = roster.filter((p) => p.unit === 'special');
        const rest = roster.filter((p) => p.unit !== 'special');
        // Specialists first: a slice of the first eleven would pick them up.
        const personnel = personnelFromRosters([...specialists, ...rest], [...specialists, ...rest]);

        const kicker = specialists.find((p) => p.position === 'K');
        expect(personnel.offense).not.toContain(kicker?.id);
        expect(personnel.defense).not.toContain(kicker?.id);
        expect(personnel.offense).toContain(rest.find((p) => p.unit === 'offense')?.id);
        expect(personnel.defense).toContain(rest.find((p) => p.unit === 'defense')?.id);
    });

    it('caps a roster that carries more than eleven', () => {
        const overflow = [
            ...generateRoster('home').filter((p) => p.unit === 'offense'),
            ...generateRoster('home').filter((p) => p.unit === 'offense'),
        ];
        expect(personnelFromRosters(overflow, overflow).offense).toHaveLength(11);
    });
});

describe('isValidPersonnel', () => {
    const roster = generateRoster('home');

    it('accepts eleven a side', () => {
        expect(isValidPersonnel(personnelFromRosters(roster, roster))).toBe(true);
    });

    it('rejects a side that is not eleven', () => {
        const ten = roster.filter((p) => p.unit === 'offense').slice(0, 10);
        expect(isValidPersonnel(personnelFromRosters(ten, roster))).toBe(false);
        expect(isValidPersonnel(personnelFromRosters(roster, ten))).toBe(false);
        expect(isValidPersonnel({ offense: [], defense: [], grouping: '11' })).toBe(false);
    });
});
