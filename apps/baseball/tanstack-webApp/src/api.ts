const BASE_URL = 'http://localhost:8080/api';

export interface League {
  id: number;
  name: string;
}

export interface Season {
  id: number;
  name: string;
  leagueId: number;
  year: number;
}

export interface Team {
  id: number;
  name: string;
}

export interface Player {
  id: number;
  name: string;
  position: string;
  jerseyNumber: number;
  battingHand: string;
  throwingHand: string;
}

export interface Game {
  id: number;
  awayTeam: Team;
  homeTeam: Team;
  awayScore: number;
  homeScore: number;
  status: string;
}

export interface PlayerBattingStats {
  playerName: string;
  teamName: string;
  games: number;
  atBats: number;
  hits: number;
  runs: number;
  rbi: number;
  homeRuns: number;
  battingAverage: number;
}

export interface SeasonStats {
  battingStats: PlayerBattingStats[];
}

export interface SeasonDashboard {
  standings: Array<{
    teamName: string;
    wins: number;
    losses: number;
    winPercentage: number;
    gamesBehind: string;
  }>;
  games: Game[];
}

export const api = {
  async getLeagues(): Promise<League[]> {
    const res = await fetch(`${BASE_URL}/leagues`);
    if (!res.ok) throw new Error('Failed to fetch leagues');
    return res.json();
  },

  async getSeasons(leagueId: number): Promise<Season[]> {
    const res = await fetch(`${BASE_URL}/seasons/league/${leagueId}`);
    if (!res.ok) throw new Error('Failed to fetch seasons');
    return res.json();
  },

  async getTeams(): Promise<Team[]> {
    const res = await fetch(`${BASE_URL}/teams`);
    if (!res.ok) throw new Error('Failed to fetch teams');
    return res.json();
  },

  async getTeamRoster(teamId: number): Promise<Player[]> {
    const res = await fetch(`${BASE_URL}/teams/${teamId}/roster`);
    if (!res.ok) throw new Error('Failed to fetch roster');
    return res.json();
  },

  async getSeasonStats(seasonId: number): Promise<SeasonStats> {
    const res = await fetch(`${BASE_URL}/stats/season/${seasonId}`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async getSeasonDashboard(seasonId: number): Promise<SeasonDashboard> {
    const res = await fetch(`${BASE_URL}/seasons/${seasonId}/dashboard`);
    if (!res.ok) throw new Error('Failed to fetch dashboard');
    return res.json();
  },

  async recordGameEvent(gameId: number, req: any): Promise<void> {
    const res = await fetch(`${BASE_URL}/game-scoring/games/${gameId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error('Failed to record game event');
  },
};
