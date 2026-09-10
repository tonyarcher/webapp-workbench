import { buildBoxScore } from './box-score';
import type { EngineGameState, EngineScorebookRow } from './rule-engine';
import type { LiveLocalGameState } from './game-state';
import type { LineupPlayer } from './game-types';
import type { LocalGameEventRecord } from './game-types';
import { matchupFromGame } from '../sim/matchup';
import { teamPrimaryColor } from './team-colors';

const SCORING_EVENT_TYPES = new Set([
  'BALL','STRIKE','FOUL','STRIKEOUT','WALK','HIT_BY_PITCH','SINGLE','DOUBLE','TRIPLE','HOME_RUN',
  'GROUNDOUT','FLYOUT','LINE_OUT','POP_OUT','SACRIFICE_FLY','SACRIFICE_BUNT','ERROR','FIELDER_CHOICE',
  'STOLEN_BASE','CAUGHT_STEALING','WILD_PITCH','PASSED_BALL','BALK','SET_LINEUP',
]);

export function battingBatterName(engine: EngineGameState): string {
  const lineup = engine.half === 'TOP' ? engine.awayLineup : engine.homeLineup;
  const index = engine.half === 'TOP' ? engine.awayBatterIdx : engine.homeBatterIdx;
  return lineup.rows[index % lineup.rows.length]?.batterName ?? 'Current Batter';
}

export function runnerOnBaseName(engine: EngineGameState, baseIndex: number): string {
  const slot = (engine.runnerSlots ?? [null, null, null])[baseIndex];
  if (slot === null || slot === undefined) return '';
  const lineup = engine.half === 'TOP' ? engine.awayLineup : engine.homeLineup;
  return lineup.rows.find((row) => row.slotIdx === slot)?.batterName ?? '';
}

export function lastPlayLabel(events: LocalGameEventRecord[]): string {
  const last = [...events].reverse().find((event) => SCORING_EVENT_TYPES.has(event.eventType));
  if (!last) return 'Awaiting first play';
  return formatLastPlay(last);
}

function formatLastPlay(last: LocalGameEventRecord): string {
  const detail = last.detail ?? {};
  const parts = [last.eventType];
  if (detail.doublePlay === true) parts.push('DOUBLE PLAY');
  if (detail.location) parts.push(String(detail.location));
  if (detail.fieldPos) parts.push(`F${detail.fieldPos}`);
  return parts.join(' · ');
}

export function pitchingPitcherName(engine: EngineGameState): string {
  const lineup = engine.half === 'TOP' ? engine.homeLineup : engine.awayLineup;
  if (lineup.pitcherName) return lineup.pitcherName;
  return lineup.rows.find((row) => row.position === 'P')?.batterName ?? `${lineup.name} pitcher`;
}

const FIELDER_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;

export function defenseFielders(
  engine: EngineGameState
): Array<{ posName: string; playerName: string; jerseyNumber: number }> {
  const lineup = engine.half === 'TOP' ? engine.homeLineup : engine.awayLineup;
  const byPos = new Map(lineup.rows.map((row) => [row.position, row]));
  return FIELDER_POSITIONS.map((pos) => {
    if (pos === 'P') {
      return { posName: 'P', playerName: lineup.pitcherName || pitchingPitcherName(engine), jerseyNumber: 0 };
    }
    const row = byPos.get(pos);
    return {
      posName: pos,
      playerName: row?.batterName || pos,
      jerseyNumber: row?.jerseyNumber ?? 0,
    };
  });
}

export function defendingTeamName(engine: EngineGameState): string {
  return engine.half === 'TOP' ? engine.homeLineup.name : engine.awayLineup.name;
}

export function matchupHands(game: LiveLocalGameState): { batterBats: string; pitcherThrows: string } {
  if (!game.setup.homeRoster || !game.setup.awayRoster) {
    return { batterBats: 'R', pitcherThrows: 'R' };
  }
  const matchup = matchupFromGame(game.engine, game.setup.homeRoster, game.setup.awayRoster);
  return { batterBats: matchup.batter.bats, pitcherThrows: matchup.pitcher.throws };
}

/** The game-json contract consumed by baseball-scoreboard and the plate scene. */
export function buildScoreboardGameJson(
  game: LiveLocalGameState,
  events: LocalGameEventRecord[],
  currentBatter: string,
  currentPitcher: string
): Record<string, unknown> {
  const { setup, engine } = game;
  return {
    id: 1,
    awayTeam: { id: 2, name: setup.awayTeamName, primaryColor: teamPrimaryColor(setup.awayTeamName) },
    homeTeam: { id: 1, name: setup.homeTeamName, primaryColor: teamPrimaryColor(setup.homeTeamName) },
    awayScore: engine.awayScore,
    homeScore: engine.homeScore,
    status: engine.over ? 'FINAL' : 'IN_PROGRESS',
    gameState: gameStateJson(game, events, currentBatter, currentPitcher),
  };
}

function gameStateJson(
  game: LiveLocalGameState,
  events: LocalGameEventRecord[],
  currentBatter: string,
  currentPitcher: string
): Record<string, unknown> {
  const { engine } = game;
  return {
    inning: engine.inning,
    half: engine.half,
    balls: engine.balls,
    strikes: engine.strikes,
    outs: engine.outs,
    runnerFirstId: engine.runners[0] ? 1 : 0,
    runnerSecondId: engine.runners[1] ? 1 : 0,
    runnerThirdId: engine.runners[2] ? 1 : 0,
    runnerFirstName: runnerOnBaseName(engine, 0),
    runnerSecondName: runnerOnBaseName(engine, 1),
    runnerThirdName: runnerOnBaseName(engine, 2),
    currentBatterName: currentBatter,
    currentPitcherName: currentPitcher,
    lastPlay: lastPlayLabel(events),
    ...matchupHands(game),
  };
}

export function rowsToEditorPlayers(rows: EngineScorebookRow[]): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    id: row.slotIdx, name: row.batterName, jerseyNumber: row.jerseyNumber ?? 0, position: row.position,
  }));
}

export function editorPlayersToLineup(value: unknown): LineupPlayer[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => toLineupPlayer(entry as Record<string, unknown>));
}

function toLineupPlayer(record: Record<string, unknown>): LineupPlayer {
  return {
    batterName: String(record.batterName ?? record.name ?? '').trim(),
    position: String(record.position ?? 'DH').trim() || 'DH',
    jerseyNumber: Number(record.jerseyNumber ?? 0),
  };
}

export function scorebookSlots(rows: EngineScorebookRow[]): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    slotIdx: row.slotIdx, batterName: row.batterName, position: row.position, jerseyNumber: row.jerseyNumber,
    atBats: row.atBats, runs: row.runs, hits: row.hits, rbi: row.rbi, innings: row.innings,
  }));
}

export function engineBadge(engine: EngineGameState): string {
  if (engine.over) return formatFinalBadge(engine);
  const halfLabel = engine.half === 'TOP' ? 'Top' : 'Bottom';
  return `${halfLabel} ${engine.inning} · ${engine.balls} balls · ${engine.strikes} strikes · ${engine.outs} outs`;
}

function formatFinalBadge(engine: EngineGameState): string {
  return `${engine.inning} inn · FINAL · Away ${engine.awayScore} · Home ${engine.homeScore}`;
}

export function buildBoxScoreJson(game: LiveLocalGameState): Record<string, unknown> {
  const boxScore = buildBoxScore(game.engine);
  return {
    lineScore: {
      awayHits: boxScore.away.hits,
      homeHits: boxScore.home.hits,
      awayErrors: boxScore.away.errors,
      homeErrors: boxScore.home.errors,
    },
  };
}
