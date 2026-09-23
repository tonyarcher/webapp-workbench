import type { Player, Position, TeamId } from 'basketball-core';
import { makePlayer } from 'basketball-core';
import { between, clamp, pickIndex } from './rng';
import type { SimRatings } from './types';

const TEAM_NAMES: [string, ...string[]] = [
    'Harbor Lights',
    'Iron Range',
    'Cedar Rapids',
    'Bayfront',
    'Northside',
    'River City',
    'Summit',
    'Lakeshore',
    'Midtown',
    'West End',
];

const FIRST_NAMES = [
    'Avery',
    'Jordan',
    'Cam',
    'Riley',
    'Quinn',
    'Sage',
    'Drew',
    'Kai',
    'Nico',
    'Elena',
    'Marcus',
    'Priya',
    'Diego',
    'Hannah',
    'Omar',
    'Chloe',
    'Theo',
    'Aisha',
    'Jamal',
    'Leah',
];

const LAST_NAMES = [
    'Haddad',
    'Okoye',
    'Brennan',
    'Sato',
    'Vargas',
    'Keller',
    'Nwosu',
    'Berg',
    'Duarte',
    'Singh',
    'Moreau',
    'Perez',
    'Cho',
    'Alvarez',
    'Brooks',
    'Ibrahim',
    'Novak',
    'Patel',
    'Reyes',
    'Kim',
];

const SLOTS: { position: Position; jersey: number; bias: Partial<SimRatings> }[] = [
    { position: 'G', jersey: 1, bias: { playmaking: 14, three: 8 } },
    { position: 'G', jersey: 2, bias: { three: 12, shooting: 8 } },
    { position: 'F', jersey: 11, bias: { shooting: 10, stamina: 6 } },
    { position: 'F', jersey: 21, bias: { rebounding: 10, defense: 8 } },
    { position: 'C', jersey: 32, bias: { rebounding: 16, shooting: -6 } },
    { position: 'G', jersey: 3, bias: { three: 6 } },
    { position: 'G', jersey: 4, bias: { playmaking: 6 } },
    { position: 'F', jersey: 12, bias: { defense: 8 } },
    { position: 'F', jersey: 22, bias: { rebounding: 6 } },
    { position: 'C', jersey: 33, bias: { rebounding: 10, defense: 6 } },
    { position: 'F', jersey: 13, bias: { shooting: 4 } },
    { position: 'C', jersey: 34, bias: { rebounding: 8 } },
];

export interface GeneratedSide {
    teamName: string;
    roster: Player[];
    ratings: Record<string, SimRatings>;
}

export function generateMatchup(random: () => number): { home: GeneratedSide; away: GeneratedSide } {
    const first = pickIndex(random, TEAM_NAMES.length);
    let second = pickIndex(random, TEAM_NAMES.length);
    if (second === first) second = (first + 1) % TEAM_NAMES.length;
    const awayName = TEAM_NAMES[first] ?? 'Away';
    const homeName = TEAM_NAMES[second] ?? 'Home';
    return {
        away: generateSide(random, 'away', awayName),
        home: generateSide(random, 'home', homeName),
    };
}

export function generateSide(random: () => number, team: TeamId, teamName: string): GeneratedSide {
    const usedNames = new Set<string>();
    const roster: Player[] = [];
    const ratings: Record<string, SimRatings> = {};
    for (const slot of SLOTS) {
        const player = namedPlayer(random, team, slot.position, slot.jersey, usedNames);
        roster.push(player);
        ratings[player.id] = rollRatings(random, slot.bias);
    }
    return { teamName, roster, ratings };
}

function namedPlayer(
    random: () => number,
    team: TeamId,
    position: Position,
    jersey: number,
    usedNames: Set<string>,
): Player {
    const base = makePlayer(team, position, jersey);
    return { ...base, name: uniqueName(random, usedNames) };
}

function uniqueName(random: () => number, used: Set<string>): string {
    for (let i = 0; i < 40; i += 1) {
        const first = FIRST_NAMES[pickIndex(random, FIRST_NAMES.length)] ?? 'Alex';
        const last = LAST_NAMES[pickIndex(random, LAST_NAMES.length)] ?? 'Lee';
        const name = `${first} ${last}`;
        if (!used.has(name)) {
            used.add(name);
            return name;
        }
    }
    const fallback = `Player ${used.size + 1}`;
    used.add(fallback);
    return fallback;
}

function rollRatings(random: () => number, bias: Partial<SimRatings>): SimRatings {
    return {
        shooting: rating(random, bias.shooting),
        three: rating(random, bias.three),
        playmaking: rating(random, bias.playmaking),
        rebounding: rating(random, bias.rebounding),
        defense: rating(random, bias.defense),
        stamina: rating(random, bias.stamina),
    };
}

function rating(random: () => number, bias = 0): number {
    return clamp(38 + between(random, 0, 42) + bias, 25, 99);
}
