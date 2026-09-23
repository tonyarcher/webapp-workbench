import type { Player } from './types';

export const ON_COURT = 5;

export function isOnCourt(onCourt: readonly string[], playerId: string): boolean {
    return onCourt.includes(playerId);
}

export function rosterIds(roster: readonly Player[]): Set<string> {
    return new Set(roster.map((player) => player.id));
}

export function isValidOnCourt(onCourt: readonly string[], roster: readonly Player[]): boolean {
    if (onCourt.length !== ON_COURT) return false;
    if (new Set(onCourt).size !== ON_COURT) return false;
    const ids = rosterIds(roster);
    return onCourt.every((id) => ids.has(id));
}

export function applySub(onCourt: readonly string[], outId: string, inId: string): string[] | null {
    if (outId === inId) return null;
    const index = onCourt.indexOf(outId);
    if (index < 0) return null;
    if (onCourt.includes(inId)) return null;
    const next = [...onCourt];
    next[index] = inId;
    return next;
}

export function findPlayer(roster: readonly Player[], playerId: string): Player | undefined {
    return roster.find((player) => player.id === playerId);
}

export function startersOf(roster: readonly Player[]): string[] {
    return roster.slice(0, ON_COURT).map((player) => player.id);
}
