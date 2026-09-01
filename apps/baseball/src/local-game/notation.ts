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

export function hitBaseCount(eventType: ScoringEventType): number {
  switch (eventType) {
    case 'SINGLE':
      return 1;
    case 'DOUBLE':
      return 2;
    case 'TRIPLE':
      return 3;
    case 'HOME_RUN':
      return 4;
    default:
      return 0;
  }
}

export function hitNotation(eventType: ScoringEventType): string {
  switch (eventType) {
    case 'SINGLE':
      return '1B';
    case 'DOUBLE':
      return '2B';
    case 'TRIPLE':
      return '3B';
    case 'HOME_RUN':
      return 'HR';
    default:
      return '';
  }
}

export function inPlayOutNotation(eventType: ScoringEventType, fieldPos?: number, doublePlay = false): string {
  switch (eventType) {
    case 'GROUNDOUT':
      if (doublePlay) return fieldPos ? `${fieldPos}-4-3` : 'GO-DP';
      if (fieldPos) return fieldPos === 3 ? '3' : `${fieldPos}-3`;
      return 'GO';
    case 'FLYOUT':
      return fieldPos ? `${fieldPos}` : 'FO';
    case 'LINE_OUT':
      if (doublePlay) return fieldPos ? `L${fieldPos}-4-3` : 'LO-DP';
      return fieldPos ? `L${fieldPos}` : 'LO';
    case 'POP_OUT':
      return fieldPos ? `P${fieldPos}` : 'PO';
    case 'SACRIFICE_FLY':
      return fieldPos ? `SF${fieldPos}` : 'SF';
    case 'SACRIFICE_BUNT':
      return fieldPos ? `SH${fieldPos}` : 'SH';
    default:
      return '';
  }
}
