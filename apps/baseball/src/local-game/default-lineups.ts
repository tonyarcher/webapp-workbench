import type { LineupPlayer } from './game-types';

export interface LocalScorebookSlot {
  slotIdx: number;
  batterName: string;
  position: string;
  jerseyNumber: number;
  atBats: number;
  runs: number;
  hits: number;
  rbi: number;
  innings: Record<string, unknown>;
}

export const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as const;

export const DEFAULT_HOME_PITCHER = 'Shota Imanaga';
export const DEFAULT_AWAY_PITCHER = 'Sonny Gray';

export const DEFAULT_HOME_LINEUP: LocalScorebookSlot[] = [
  { slotIdx: 1, batterName: 'Nico Hoerner', position: '2B', jerseyNumber: 2, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 2, batterName: 'Dansby Swanson', position: 'SS', jerseyNumber: 7, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 3, batterName: 'Ian Happ', position: 'LF', jerseyNumber: 8, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 4, batterName: 'Seiya Suzuki', position: 'RF', jerseyNumber: 27, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 5, batterName: 'Cody Bellinger', position: 'CF', jerseyNumber: 24, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 6, batterName: 'Christopher Morel', position: 'DH', jerseyNumber: 5, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 7, batterName: 'Miguel Amaya', position: 'C', jerseyNumber: 9, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 8, batterName: 'Michael Busch', position: '1B', jerseyNumber: 29, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 9, batterName: 'Patrick Wisdom', position: '3B', jerseyNumber: 16, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
];

export const DEFAULT_AWAY_LINEUP: LocalScorebookSlot[] = [
  { slotIdx: 1, batterName: 'Brendan Donovan', position: '2B', jerseyNumber: 33, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 2, batterName: 'Paul Goldschmidt', position: '1B', jerseyNumber: 46, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 3, batterName: 'Nolan Arenado', position: '3B', jerseyNumber: 28, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 4, batterName: 'Willson Contreras', position: 'DH', jerseyNumber: 40, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 5, batterName: 'Lars Nootbaar', position: 'CF', jerseyNumber: 21, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 6, batterName: 'Alec Burleson', position: 'LF', jerseyNumber: 41, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 7, batterName: 'Jordan Walker', position: 'RF', jerseyNumber: 18, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 8, batterName: 'Tommy Edman', position: 'SS', jerseyNumber: 19, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 9, batterName: 'Iván Herrera', position: 'C', jerseyNumber: 48, atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
];

export function toLineupPlayers(slots: LocalScorebookSlot[]): LineupPlayer[] {
  return slots.map((slot) => ({
    batterName: slot.batterName,
    position: slot.position,
    jerseyNumber: slot.jerseyNumber,
  }));
}

export function lineupPlayersFromUnknown(value: unknown): LineupPlayer[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const players: LineupPlayer[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      players.push({ batterName: '', position: 'DH', jerseyNumber: 0 });
      continue;
    }
    const record = entry as Record<string, unknown>;
    const batterName = String(record.batterName ?? record.name ?? '').trim();
    const position = String(record.position ?? '').trim();
    const jerseyRaw = Number(record.jerseyNumber);
    players.push({
      batterName,
      position: position || 'DH',
      jerseyNumber: Number.isFinite(jerseyRaw) ? jerseyRaw : 0,
    });
  }
  return players.length > 0 ? players : undefined;
}
