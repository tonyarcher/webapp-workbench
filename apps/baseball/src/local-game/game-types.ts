export interface LineupPlayer {
  batterName: string;
  position: string;
  jerseyNumber?: number;
}

export interface LocalGameSetup {
  homeTeamName: string;
  awayTeamName: string;
  innings: number;
  homeLineup?: LineupPlayer[];
  awayLineup?: LineupPlayer[];
  homePitcherName?: string;
  awayPitcherName?: string;
}

export interface LocalGameEventRecord {
  id: number;
  eventType: string;
  occurredAt: string;
  detail: Record<string, unknown>;
}

export const DEFAULT_GAME_SETUP: LocalGameSetup = {
  homeTeamName: 'Chicago Cubs',
  awayTeamName: 'St. Louis Cardinals',
  innings: 9,
};
