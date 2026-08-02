import type { ScoringEventType } from './rule-engine';

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

export function inPlayOutNotation(eventType: ScoringEventType, fieldPos?: number): string {
  switch (eventType) {
    case 'GROUNDOUT':
      if (fieldPos) return fieldPos === 3 ? '3' : `${fieldPos}-3`;
      return 'GO';
    case 'FLYOUT':
      return fieldPos ? `${fieldPos}` : 'FO';
    case 'LINE_OUT':
      return fieldPos ? `L${fieldPos}` : 'LO';
    case 'POP_OUT':
      return fieldPos ? `P${fieldPos}` : 'PO';
    case 'SACRIFICE_FLY':
      return fieldPos ? `SF${fieldPos}` : 'SF';
    default:
      return '';
  }
}
