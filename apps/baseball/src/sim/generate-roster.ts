import { clamp, pickItem, pickIndex } from './rng';
import { PITCH_TYPES } from './types';
import type { Handedness, PitchType, PlayerRatings, SimPlayer, SimPitcher, SimRoster } from './types';

const TEAM_NAMES = [
  'Springfield Isotopes',
  'New York Knights',
  'Durham Bulls',
  'Rockford Peaches',
  'Portland Pickles',
  'Savannah Bananas',
  'Kansas City Monarchs',
  'Brooklyn Cyclones',
  'Toledo Mud Hens',
  'Hartford Yard Goats',
  'Sugar Land Space Cowboys',
  'Rocket City Trash Pandas',
  'El Paso Chihuahuas',
  'Amarillo Sod Poodles',
  'Columbus Clippers',
  'Las Vegas Aviators',
  'Round Rock Express',
  'Omaha Storm Chasers',
  'Scranton RailRiders',
  'Albuquerque Rose Sox',
];

const FIRST_NAMES = [
  'Luis', 'Maya', 'Andre', 'Sofia', 'Kenji', 'Elena', 'Marcus', 'Priya', 'Diego', 'Hannah',
  'Omar', 'Chloe', 'Theo', 'Aisha', 'Nico', 'Grace', 'Jamal', 'Riley', 'Mateo', 'Quinn',
  'Hiro', 'Nora', 'Caleb', 'Imani', 'Felix', 'Sasha', 'Owen', 'Leah', 'Rafael', 'Zoe',
];

const LAST_NAMES = [
  'Haddad', 'Okoye', 'Brennan', 'Sato', 'Vargas', 'Keller', 'Nwosu', 'Berg', 'Duarte', 'Singh',
  'Moreau', 'Perez', 'Cho', 'Lindholm', 'Alvarez', 'Brooks', 'Ibrahim', 'Novak', 'Patel', 'Reyes',
  'Okafor', 'Lambert', 'Cruz', 'Nguyen', 'Foster', 'Khan', 'Diaz', 'Walsh', 'Kim', 'Romano',
];

const BATTER_POSITIONS = ['CF', 'SS', '2B', 'LF', 'RF', '3B', 'C', '1B', 'DH'] as const;

const SLOT_BIAS: Array<Partial<PlayerRatings>> = [
  { speed: 14, discipline: 10, power: -8 },
  { speed: 10, contact: 8, discipline: 6, power: -4 },
  { contact: 10, power: 10 },
  { power: 16, contact: 4, speed: -6 },
  { power: 8, contact: 6 },
  { contact: 4, speed: 4 },
  { bunt: 8, contact: -4, power: -6 },
  { power: 6, speed: -8 },
  { bunt: 10, contact: -6, power: -8, speed: -4 },
];

export interface LineupLike {
  batterName: string;
  position: string;
  jerseyNumber?: number;
}

export function generateMatchup(random: () => number): { home: SimRoster; away: SimRoster } {
  const first = pickIndex(random, TEAM_NAMES.length);
  let second = pickIndex(random, TEAM_NAMES.length);
  if (second === first) second = (first + 1) % TEAM_NAMES.length;
  return {
    away: generateRoster(random, TEAM_NAMES[first]),
    home: generateRoster(random, TEAM_NAMES[second]),
  };
}

export function generateRoster(random: () => number, teamName: string): SimRoster {
  const usedJerseys = new Set<number>();
  const usedNames = new Set<string>();
  const lineup = BATTER_POSITIONS.map((position, index) =>
    makeBatter(random, position, SLOT_BIAS[index] ?? {}, usedJerseys, usedNames)
  );
  return {
    teamName,
    lineup,
    pitcher: makePitcher(random, usedJerseys, usedNames),
  };
}

export function rosterFromLineup(
  random: () => number,
  teamName: string,
  players: LineupLike[],
  pitcherName: string
): SimRoster {
  const usedJerseys = new Set<number>();
  const lineup = players.slice(0, 9).map((player, index) => {
    const jersey = player.jerseyNumber && player.jerseyNumber > 0 ? player.jerseyNumber : uniqueJersey(random, usedJerseys);
    usedJerseys.add(jersey);
    return {
      batterName: player.batterName,
      position: player.position || BATTER_POSITIONS[index] || 'DH',
      jerseyNumber: jersey,
      bats: handedness(random, 0.28),
      throws: handedness(random, 0.12),
      ratings: rollRatings(random, SLOT_BIAS[index] ?? {}),
    };
  });
  return {
    teamName,
    lineup,
    pitcher: {
      name: pitcherName,
      throws: handedness(random, 0.28),
      ratings: rollPitcherRatings(random),
    },
  };
}

export function lineupFromRoster(roster: SimRoster): LineupLike[] {
  return roster.lineup.map((player) => ({
    batterName: player.batterName,
    position: player.position,
    jerseyNumber: player.jerseyNumber,
  }));
}

function makeBatter(
  random: () => number,
  position: string,
  bias: Partial<PlayerRatings>,
  usedJerseys: Set<number>,
  usedNames: Set<string>
): SimPlayer {
  return {
    batterName: uniqueName(random, usedNames),
    position,
    jerseyNumber: uniqueJersey(random, usedJerseys),
    bats: handedness(random, 0.28),
    throws: handedness(random, 0.12),
    ratings: rollRatings(random, bias),
  };
}

function makePitcher(random: () => number, usedJerseys: Set<number>, usedNames: Set<string>): SimPitcher {
  void usedJerseys;
  return {
    name: uniqueName(random, usedNames),
    throws: handedness(random, 0.28),
    ratings: rollPitcherRatings(random),
  };
}

function rollRatings(random: () => number, bias: Partial<PlayerRatings>): PlayerRatings {
  return {
    contact: rating(random, bias.contact),
    power: rating(random, bias.power),
    discipline: rating(random, bias.discipline),
    speed: rating(random, bias.speed),
    bunt: rating(random, bias.bunt),
  };
}

function rollPitcherRatings(random: () => number): SimPitcher['ratings'] {
  const extras = PITCH_TYPES.filter((pitch) => pitch !== 'Fastball');
  const extraCount = 2 + pickIndex(random, 3);
  const arsenal: PitchType[] = ['Fastball'];
  const pool = [...extras];
  for (let i = 0; i < extraCount && pool.length > 0; i++) {
    const index = pickIndex(random, pool.length);
    arsenal.push(pool.splice(index, 1)[0]);
  }
  return {
    control: rating(random, 0),
    stuff: rating(random, 0),
    gbTendency: rating(random, 0),
    arsenal,
  };
}

function rating(random: () => number, bias = 0): number {
  return clamp(Math.round(38 + random() * 42 + (bias ?? 0)), 25, 99);
}

function handedness(random: () => number, leftChance: number): Handedness {
  return random() < leftChance ? 'L' : 'R';
}

function uniqueName(random: () => number, used: Set<string>): string {
  for (let attempt = 0; attempt < 40; attempt++) {
    const name = `${pickItem(random, FIRST_NAMES)} ${pickItem(random, LAST_NAMES)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const fallback = `${pickItem(random, FIRST_NAMES)} ${pickItem(random, LAST_NAMES)} ${used.size + 1}`;
  used.add(fallback);
  return fallback;
}

function uniqueJersey(random: () => number, used: Set<number>): number {
  for (let attempt = 0; attempt < 40; attempt++) {
    const number = 1 + Math.floor(random() * 99);
    if (!used.has(number)) {
      used.add(number);
      return number;
    }
  }
  const fallback = used.size + 1;
  used.add(fallback);
  return fallback;
}
