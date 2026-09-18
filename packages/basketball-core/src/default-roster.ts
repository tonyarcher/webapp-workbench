import type {Player, Position, TeamId} from './types';
import {startersOf} from './lineup';

const SLOTS: {position: Position; jersey: number}[] = [
    {position: 'G', jersey: 1},
    {position: 'G', jersey: 2},
    {position: 'F', jersey: 11},
    {position: 'F', jersey: 21},
    {position: 'C', jersey: 32},
    {position: 'G', jersey: 3},
    {position: 'G', jersey: 4},
    {position: 'F', jersey: 12},
    {position: 'F', jersey: 22},
    {position: 'C', jersey: 33},
    {position: 'F', jersey: 13},
    {position: 'C', jersey: 34},
];

export function makePlayer(team: TeamId, position: Position, jersey: number): Player {
    return {
        id: `${team}-${jersey}`,
        name: `${position} ${jersey}`,
        jersey,
        position,
    };
}

export function generateRoster(team: TeamId): Player[] {
    return SLOTS.map((slot) => makePlayer(team, slot.position, slot.jersey));
}

export function defaultOnCourt(roster: readonly Player[]): string[] {
    return startersOf(roster);
}
