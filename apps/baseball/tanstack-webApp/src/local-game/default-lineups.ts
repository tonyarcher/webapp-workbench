export interface LocalScorebookSlot {
  slotIdx: number;
  batterName: string;
  position: string;
  atBats: number;
  runs: number;
  hits: number;
  rbi: number;
  innings: Record<string, unknown>;
}

export const DEFAULT_HOME_LINEUP: LocalScorebookSlot[] = [
  { slotIdx: 1, batterName: 'Nico Hoerner', position: '2B', atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 2, batterName: 'Dansby Swanson', position: 'SS', atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 3, batterName: 'Ian Happ', position: 'LF', atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 4, batterName: 'Seiya Suzuki', position: 'RF', atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 5, batterName: 'Cody Bellinger', position: 'CF', atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 6, batterName: 'Christopher Morel', position: 'DH', atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 7, batterName: 'Miguel Amaya', position: 'C', atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 8, batterName: 'Michael Busch', position: '1B', atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
  { slotIdx: 9, batterName: 'Patrick Wisdom', position: '3B', atBats: 0, runs: 0, hits: 0, rbi: 0, innings: {} },
];
