import { isOnCourt } from 'basketball-core';
import type { GameState, TeamId } from 'basketball-core';
import { chance, pickIndex } from './rng';
import type { SimRatings } from './types';

export type ShotZone = 'paint' | 'mid' | 'three';

const DEFAULT: SimRatings = {
    shooting: 50,
    three: 50,
    playmaking: 50,
    rebounding: 50,
    defense: 50,
    stamina: 50,
};

export function ratingsFor(id: string, table: Record<string, SimRatings> | undefined): SimRatings {
    return table?.[id] ?? DEFAULT;
}

export function pickShooter(
    game: GameState,
    team: TeamId,
    random: () => number,
    table?: Record<string, SimRatings>,
): string {
    return pickOnCourt(game, team, random, table, 'shooting');
}

export function pickOnCourt(
    game: GameState,
    team: TeamId,
    random: () => number,
    table: Record<string, SimRatings> | undefined,
    skill: keyof SimRatings,
): string {
    const ids = team === 'home' ? game.home.onCourt : game.away.onCourt;
    const weights = ids.map((id) => {
        const row = ratingsFor(id, table);
        return skill === 'shooting' ? row.shooting + row.three : row[skill];
    });
    return pickWeighted(ids, weights, random) ?? ids[0] ?? '';
}

export function pickPasser(
    game: GameState,
    team: TeamId,
    shooterId: string,
    random: () => number,
    table?: Record<string, SimRatings>,
): string | undefined {
    const ids = (team === 'home' ? game.home.onCourt : game.away.onCourt).filter((id) => id !== shooterId);
    if (ids.length === 0) return undefined;
    const passer = pickWeighted(
        ids,
        ids.map((id) => ratingsFor(id, table).playmaking),
        random,
    );
    return passer;
}

export function pickZone(random: () => number, ratings: SimRatings): ShotZone {
    if (chance(random, ratings.three / 220)) return 'three';
    if (chance(random, ratings.shooting / 180)) return 'mid';
    return 'paint';
}

export function shouldAssist(random: () => number, passer: SimRatings): boolean {
    return chance(random, 0.25 + passer.playmaking / 250);
}

export function shouldSub(game: GameState, team: TeamId, random: () => number): { outId: string; inId: string } | null {
    if (!chance(random, 0.04)) return null;
    const side = team === 'home' ? game.home : game.away;
    const bench = side.roster.map((p) => p.id).filter((id) => !isOnCourt(side.onCourt, id));
    if (bench.length === 0) return null;
    const outId = side.onCourt[pickIndex(random, side.onCourt.length)];
    const inId = bench[pickIndex(random, bench.length)];
    if (!outId || !inId) return null;
    return { outId, inId };
}

function pickWeighted(ids: string[], weights: number[], random: () => number): string | undefined {
    const total = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
    if (total <= 0) return ids[pickIndex(random, ids.length)];
    let cursor = random() * total;
    for (let i = 0; i < ids.length; i += 1) {
        cursor -= Math.max(0, weights[i] ?? 0);
        if (cursor <= 0) return ids[i];
    }
    return ids[ids.length - 1];
}
