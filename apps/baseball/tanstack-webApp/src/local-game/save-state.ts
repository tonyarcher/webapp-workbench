import type { LiveLocalGameState } from '../App';
import type { EngineGameState } from './rule-engine';
import type { LocalGameEventRecord, LocalGameSetup } from './game-types';

export const SAVE_STORAGE_KEY = 'baseball.local-game.v1';
export const SAVE_STATE_VERSION = 3;

export interface PersistedGameState {
  version: number;
  savedAt: string;
  setup: LocalGameSetup;
  engine: EngineGameState;
  historyIndex: number;
  events: LocalGameEventRecord[];
}

export interface GameStateStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEngineGameState(value: unknown): value is EngineGameState {
  if (!isRecord(value)) return false;
  return (
    isRecord(value.awayLineup) &&
    isRecord(value.homeLineup) &&
    Array.isArray(value.awayLineup.rows) &&
    Array.isArray(value.homeLineup.rows) &&
    typeof value.inning === 'number' &&
    typeof value.balls === 'number' &&
    typeof value.strikes === 'number' &&
    typeof value.outs === 'number' &&
    typeof value.awayScore === 'number' &&
    typeof value.homeScore === 'number' &&
    (value.half === 'TOP' || value.half === 'BOTTOM') &&
    Array.isArray(value.runners) &&
    value.runners.length === 3 &&
    typeof value.awayBatterIdx === 'number' &&
    typeof value.homeBatterIdx === 'number' &&
    Array.isArray(value.awayRunsByInning) &&
    value.awayRunsByInning.every((run: unknown) => typeof run === 'number') &&
    Array.isArray(value.homeRunsByInning) &&
    value.homeRunsByInning.every((run: unknown) => typeof run === 'number') &&
    typeof value.awayErrors === 'number' &&
    typeof value.homeErrors === 'number' &&
    typeof value.totalInnings === 'number' &&
    typeof value.over === 'boolean'
  );
}

function isLocalGameSetup(value: unknown): value is LocalGameSetup {
  if (!isRecord(value)) return false;
  return (
    typeof value.homeTeamName === 'string' &&
    typeof value.awayTeamName === 'string' &&
    typeof value.innings === 'number'
  );
}

function isLocalGameEventRecord(value: unknown): value is LocalGameEventRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'number' &&
    typeof value.eventType === 'string' &&
    typeof value.occurredAt === 'string' &&
    isRecord(value.detail)
  );
}

function isPersistedGameState(value: unknown): value is PersistedGameState {
  if (!isRecord(value)) return false;
  if (value.version !== SAVE_STATE_VERSION) return false;
  if (typeof value.savedAt !== 'string') return false;
  if (!isLocalGameSetup(value.setup)) return false;
  if (!isEngineGameState(value.engine)) return false;
  if (!Array.isArray(value.events) || !value.events.every(isLocalGameEventRecord)) return false;
  if (typeof value.historyIndex !== 'number' || !Number.isInteger(value.historyIndex)) return false;
  return value.historyIndex >= 0 && value.historyIndex <= value.events.length;
}

export function serializeGameState(state: LiveLocalGameState, now = new Date()): string {
  const persisted: PersistedGameState = {
    version: SAVE_STATE_VERSION,
    savedAt: now.toISOString(),
    setup: state.setup,
    engine: state.engine,
    historyIndex: state.historyIndex,
    events: state.events,
  };
  return JSON.stringify(persisted);
}

export function deserializeGameState(raw: string | null): LiveLocalGameState | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPersistedGameState(parsed)) return null;
  return { setup: parsed.setup, engine: parsed.engine, historyIndex: parsed.historyIndex, events: parsed.events };
}

function defaultStore(): GameStateStore | null {
  if (typeof globalThis === 'undefined') return null;
  const storage = (globalThis as { localStorage?: GameStateStore }).localStorage;
  return storage ?? null;
}

export function loadGameState(store: GameStateStore | null = defaultStore()): LiveLocalGameState | null {
  if (!store) return null;
  try {
    return deserializeGameState(store.getItem(SAVE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function persistGameState(state: LiveLocalGameState, store: GameStateStore | null = defaultStore()): void {
  if (!store) return;
  try {
    store.setItem(SAVE_STORAGE_KEY, serializeGameState(state));
  } catch {
    // storage can be unavailable (quota, disabled); the game still works in memory
  }
}

export function clearGameState(store: GameStateStore | null = defaultStore()): void {
  if (!store) return;
  try {
    store.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
