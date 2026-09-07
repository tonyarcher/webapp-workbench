import type {Personnel, Player, PlayerUnit, TeamId} from './types';

const OFFENSE: {position: string; jersey: number}[] = [
    {position: 'QB', jersey: 9},
    {position: 'RB', jersey: 22},
    {position: 'WR', jersey: 11},
    {position: 'WR', jersey: 18},
    {position: 'WR', jersey: 1},
    {position: 'TE', jersey: 87},
    {position: 'LT', jersey: 71},
    {position: 'LG', jersey: 65},
    {position: 'C', jersey: 56},
    {position: 'RG', jersey: 64},
    {position: 'RT', jersey: 77},
];

const DEFENSE: {position: string; jersey: number}[] = [
    {position: 'DE', jersey: 99},
    {position: 'DT', jersey: 97},
    {position: 'DT', jersey: 93},
    {position: 'DE', jersey: 91},
    {position: 'LB', jersey: 54},
    {position: 'LB', jersey: 51},
    {position: 'LB', jersey: 45},
    {position: 'CB', jersey: 23},
    {position: 'CB', jersey: 27},
    {position: 'S', jersey: 32},
    {position: 'S', jersey: 21},
];

const SPECIAL: {position: string; jersey: number}[] = [
    {position: 'K', jersey: 3},
    {position: 'P', jersey: 8},
    {position: 'LS', jersey: 47},
];

function makePlayer(team: TeamId, position: string, jersey: number, unit: PlayerUnit): Player {
    return {
        id: `${team}-${jersey}-${position}`,
        name: `${position} ${jersey}`,
        jersey,
        position,
        unit,
    };
}

export function generateRoster(team: TeamId): Player[] {
    return [
        ...OFFENSE.map((row) => makePlayer(team, row.position, row.jersey, 'offense')),
        ...DEFENSE.map((row) => makePlayer(team, row.position, row.jersey, 'defense')),
        ...SPECIAL.map((row) => makePlayer(team, row.position, row.jersey, 'special')),
    ];
}

export function personnelFromRosters(
    offenseRoster: Player[],
    defenseRoster: Player[],
): Personnel {
    const offense = offenseRoster.filter((p) => p.unit === 'offense').slice(0, 11).map((p) => p.id);
    const defense = defenseRoster.filter((p) => p.unit === 'defense').slice(0, 11).map((p) => p.id);
    return {offense, defense, grouping: '11'};
}

export function isValidPersonnel(personnel: Personnel): boolean {
    return personnel.offense.length === 11 && personnel.defense.length === 11;
}
