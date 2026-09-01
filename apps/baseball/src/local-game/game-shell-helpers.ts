import type { EngineGameState, EngineScorebookRow } from './rule-engine';
import type { LineupPlayer } from './game-types';
import type { LocalGameEventRecord } from './game-types';

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
