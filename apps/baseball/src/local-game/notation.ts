import type { RunnersOnBase, ScoringEventType } from './rule-engine';

export interface Advancement {
  from: number;
  to: number;
  scored: boolean;
}

export function runnerAdvancementsForHit(runners: RunnersOnBase, bases: number): Advancement[] {
  return advanceOccupiedRunners(runners, bases);
}

export function runnerAdvancementsForWalk(runners: RunnersOnBase): Advancement[] {
  return advanceOccupiedRunners(runners, 1);
}

export function runnerAdvancementsForSacrifice(runners: RunnersOnBase): Advancement[] {
  return runners[2] ? [{ from: 3, to: 4, scored: true }] : [];
}

export function runnerAdvancementsForSteal(from: number, to: number): Advancement[] {
  if (from < 1 || from > 3) return [];
  const destination = to > 3 ? 4 : to;
  return [{ from, to: destination, scored: destination === 4 }];
}

function advanceOccupiedRunners(runners: RunnersOnBase, bases: number): Advancement[] {
  const advancements: Advancement[] = [];
  for (const base of occupiedBases(runners)) {
    const destination = base + bases;
    if (destination > 3) {
      advancements.push({ from: base, to: 4, scored: true });
    } else {
      advancements.push({ from: base, to: destination, scored: false });
    }
  }
  return advancements;
}

function occupiedBases(runners: RunnersOnBase): number[] {
  return runners.reduce<number[]>((bases, occupied, index) => {
    if (occupied) bases.push(index + 1);
    return bases;
  }, []);
}

const HIT_BASES: Partial<Record<ScoringEventType, number>> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  HOME_RUN: 4,
};

const HIT_MARKS: Partial<Record<ScoringEventType, string>> = {
  SINGLE: '1B',
  DOUBLE: '2B',
  TRIPLE: '3B',
  HOME_RUN: 'HR',
};

export function hitBaseCount(eventType: ScoringEventType): number {
  return HIT_BASES[eventType] ?? 0;
}

export function hitNotation(eventType: ScoringEventType): string {
  return HIT_MARKS[eventType] ?? '';
}

function withPos(prefix: string, fieldPos: number | undefined, fallback: string): string {
  return fieldPos ? `${prefix}${fieldPos}` : fallback;
}

function groundoutNotation(fieldPos?: number, doublePlay = false): string {
  if (doublePlay) return fieldPos ? `${fieldPos}-4-3` : 'GO-DP';
  if (!fieldPos) return 'GO';
  return fieldPos === 3 ? '3' : `${fieldPos}-3`;
}

function lineoutNotation(fieldPos?: number, doublePlay = false): string {
  if (doublePlay) return fieldPos ? `L${fieldPos}-4-3` : 'LO-DP';
  return withPos('L', fieldPos, 'LO');
}

export function inPlayOutNotation(eventType: ScoringEventType, fieldPos?: number, doublePlay = false): string {
  if (eventType === 'GROUNDOUT') return groundoutNotation(fieldPos, doublePlay);
  if (eventType === 'FLYOUT') return fieldPos ? `${fieldPos}` : 'FO';
  if (eventType === 'LINE_OUT') return lineoutNotation(fieldPos, doublePlay);
  if (eventType === 'POP_OUT') return withPos('P', fieldPos, 'PO');
  if (eventType === 'SACRIFICE_FLY') return withPos('SF', fieldPos, 'SF');
  if (eventType === 'SACRIFICE_BUNT') return withPos('SH', fieldPos, 'SH');
  return '';
}
