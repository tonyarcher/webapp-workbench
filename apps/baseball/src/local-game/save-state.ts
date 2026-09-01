import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { LiveLocalGameState } from './game-state';
import type { EngineGameState } from './rule-engine';
import type { LocalGameEventRecord, LocalGameSetup } from './game-types';

export const SAVE_DB_NAME = 'baseball-db';
export const SAVE_STORE_NAME = 'games';
export const SAVE_RECORD_KEY = 'current';
export const SAVE_STATE_VERSION = 4;

export interface PersistedGameState {
  version: number;
  savedAt: string;
  setup: LocalGameSetup;
  engine: EngineGameState;
  historyIndex: number;
  events: LocalGameEventRecord[];
}

interface BaseballDB extends DBSchema {
  [SAVE_STORE_NAME]: {
    key: string;
    value: PersistedGameState;
  };
}

export function openGameDB(): Promise<IDBPDatabase<BaseballDB>> {
  return openDB<BaseballDB>(SAVE_DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SAVE_STORE_NAME)) {
        db.createObjectStore(SAVE_STORE_NAME);
      }
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

function hasLineupShape(value: Record<string, unknown>): boolean {
  if (!isRecord(value.awayLineup) || !isRecord(value.homeLineup)) return false;
  return Array.isArray(value.awayLineup.rows) && Array.isArray(value.homeLineup.rows);
}

function hasCountShape(value: Record<string, unknown>): boolean {
  return (
    typeof value.inning === 'number' &&
    typeof value.balls === 'number' &&
    typeof value.strikes === 'number' &&
    typeof value.outs === 'number'
  );
}

function hasScoreShape(value: Record<string, unknown>): boolean {
  return (
    typeof value.awayScore === 'number' &&
    typeof value.homeScore === 'number' &&
    typeof value.awayErrors === 'number' &&
    typeof value.homeErrors === 'number'
  );
}

function hasMetaShape(value: Record<string, unknown>): boolean {
  const halfOk = value.half === 'TOP' || value.half === 'BOTTOM';
  const runnersOk = Array.isArray(value.runners) && value.runners.length === 3;
  const idxOk = typeof value.awayBatterIdx === 'number' && typeof value.homeBatterIdx === 'number';
  return halfOk && runnersOk && idxOk && typeof value.totalInnings === 'number' && typeof value.over === 'boolean';
}

function isEngineGameState(value: unknown): value is EngineGameState {
  if (!isRecord(value) || !hasLineupShape(value) || !hasCountShape(value) || !hasScoreShape(value)) return false;
  return hasMetaShape(value) && isNumberArray(value.awayRunsByInning) && isNumberArray(value.homeRunsByInning);
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

function hasEventList(value: Record<string, unknown>): boolean {
  return Array.isArray(value.events) && value.events.every(isLocalGameEventRecord);
}

function hasHistoryIndex(value: Record<string, unknown>, eventCount: number): boolean {
  if (typeof value.historyIndex !== 'number' || !Number.isInteger(value.historyIndex)) return false;
  return value.historyIndex >= 0 && value.historyIndex <= eventCount;
}

export function isValidPersistedGameState(value: unknown): value is PersistedGameState {
  if (!isRecord(value) || value.version !== SAVE_STATE_VERSION) return false;
  if (typeof value.savedAt !== 'string' || !isLocalGameSetup(value.setup)) return false;
  if (!isEngineGameState(value.engine) || !hasEventList(value)) return false;
  return hasHistoryIndex(value, (value.events as LocalGameEventRecord[]).length);
}

export async function loadGameState(
  db: Promise<IDBPDatabase<BaseballDB>> = openGameDB()
): Promise<LiveLocalGameState | null> {
  const database = await db;
  const raw = await database.get(SAVE_STORE_NAME, SAVE_RECORD_KEY);
  if (!isValidPersistedGameState(raw)) return null;
  return { setup: raw.setup, engine: raw.engine, historyIndex: raw.historyIndex, events: raw.events };
}

export async function saveGameState(
  state: LiveLocalGameState,
  db: Promise<IDBPDatabase<BaseballDB>> = openGameDB(),
  now = new Date()
): Promise<void> {
  const database = await db;
  const persisted: PersistedGameState = {
    version: SAVE_STATE_VERSION,
    savedAt: now.toISOString(),
    setup: state.setup,
    engine: state.engine,
    historyIndex: state.historyIndex,
    events: state.events,
  };
  await database.put(SAVE_STORE_NAME, persisted, SAVE_RECORD_KEY);
}

export async function clearGameState(
  db: Promise<IDBPDatabase<BaseballDB>> = openGameDB()
): Promise<void> {
  const database = await db;
  await database.delete(SAVE_STORE_NAME, SAVE_RECORD_KEY);
}
