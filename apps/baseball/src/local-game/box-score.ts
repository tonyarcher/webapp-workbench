import type { EngineGameState, EngineScorebookRow } from './rule-engine';

export interface BoxScoreBattingLine {
  player: string;
  position: string;
  ab: number;
  runs: number;
  hits: number;
  rbi: number;
  walks: number;
}

export interface BoxScoreTeam {
  name: string;
  runsByInning: number[];
  runs: number;
  hits: number;
  errors: number;
  batting: BoxScoreBattingLine[];
}

export interface BoxScore {
  away: BoxScoreTeam;
  home: BoxScoreTeam;
  innings: number;
}

export function buildBoxScore(engine: EngineGameState): BoxScore {
  return {
    away: buildTeam(
      engine.awayLineup.name,
      engine.awayScore,
      engine.awayRunsByInning,
      engine.awayErrors,
      engine.awayLineup.rows
    ),
    home: buildTeam(
      engine.homeLineup.name,
      engine.homeScore,
      engine.homeRunsByInning,
      engine.homeErrors,
      engine.homeLineup.rows
    ),
    innings: Math.max(engine.awayRunsByInning.length, engine.homeRunsByInning.length, engine.totalInnings),
  };
}

function buildTeam(
  name: string,
  runs: number,
  runsByInning: number[],
  errors: number,
  rows: EngineScorebookRow[]
): BoxScoreTeam {
  return {
    name,
    runs,
    runsByInning,
    errors,
    hits: rows.reduce((sum, row) => sum + row.hits, 0),
    batting: rows.map(toBattingLine),
  };
}

function toBattingLine(row: EngineScorebookRow): BoxScoreBattingLine {
  return {
    player: row.batterName,
    position: row.position,
    ab: row.atBats,
    runs: row.runs,
    hits: row.hits,
    rbi: row.rbi,
    walks: row.walks,
  };
}
