export interface LocalGameSetup {
  homeTeamName: string;
  awayTeamName: string;
  innings: number;
}

export interface LocalGameEventRecord {
  id: number;
  eventType: string;
  occurredAt: string;
  detail: Record<string, unknown>;
}

export interface LocalGameState {
  setup: LocalGameSetup | null;
  events: LocalGameEventRecord[];
}

export const DEFAULT_GAME_SETUP: LocalGameSetup = {
  homeTeamName: 'Chicago Cubs',
  awayTeamName: 'St. Louis Cardinals',
  innings: 9,
};
