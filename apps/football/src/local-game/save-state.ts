import {openDB} from 'idb';
import type {DBSchema, IDBPDatabase} from 'idb';
import {SCORING_EVENT_TYPES} from 'football-core';
import type {GameState, ScoringEvent} from 'football-core';
import type {LiveLocalGameState} from './game-state';
import type {LocalGameEventRecord, LocalGameSetup} from './game-types';

export const SAVE_DB_NAME = 'football-db';
export const SAVE_STORE_NAME = 'games';
export const SAVE_RECORD_KEY = 'current';
export const SAVE_STATE_VERSION = 1;

export interface PersistedGameState {
    version: number;
    savedAt: string;
    setup: LocalGameSetup;
    engine: GameState;
    historyIndex: number;
    events: LocalGameEventRecord[];
}

interface FootballDB extends DBSchema {
    [SAVE_STORE_NAME]: {
        key: string;
        value: PersistedGameState;
    };
}

export function openGameDB(): Promise<IDBPDatabase<FootballDB>> {
    return openDB<FootballDB>(SAVE_DB_NAME, 1, {
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

function isLocalGameSetup(value: unknown): value is LocalGameSetup {
    if (!isRecord(value)) return false;
    return (
        typeof value.homeName === 'string' &&
        typeof value.awayName === 'string' &&
        (value.rulebookId === 'nfl' ||
            value.rulebookId === 'ncaa' ||
            value.rulebookId === 'nfhs-mn' ||
            value.rulebookId === 'nfhs-co') &&
        (value.receivingTeam === 'home' || value.receivingTeam === 'away')
    );
}

function isScoringEvent(value: unknown): value is ScoringEvent {
    if (!isRecord(value) || typeof value.type !== 'string') return false;
    return (SCORING_EVENT_TYPES as readonly string[]).includes(value.type);
}

function isLocalGameEventRecord(value: unknown): value is LocalGameEventRecord {
    if (!isRecord(value)) return false;
    return (
        typeof value.id === 'number' &&
        typeof value.occurredAt === 'string' &&
        isScoringEvent(value.event)
    );
}

function isEngineGameState(value: unknown): value is GameState {
    if (!isRecord(value) || !isRecord(value.clock) || !isRecord(value.score) || !isRecord(value.situation)) return false;
    const flags = [value.over, value.kickoffPending, value.pendingTry].every((flag) => typeof flag === 'boolean');
    const nested = [value.clock.period, value.clock.gameClockSeconds, value.score.home, value.score.away, value.situation.down]
        .every((n) => typeof n === 'number');
    return typeof value.rulebookId === 'string' && flags && nested && Array.isArray(value.plays) && Array.isArray(value.drives);
}

function hasHistoryIndex(value: Record<string, unknown>, eventCount: number): boolean {
    const index = value.historyIndex;
    return typeof index === 'number' && Number.isInteger(index) && index >= 0 && index <= eventCount;
}

export function isValidPersistedGameState(value: unknown): value is PersistedGameState {
    if (!isRecord(value) || value.version !== SAVE_STATE_VERSION || typeof value.savedAt !== 'string') return false;
    if (!isLocalGameSetup(value.setup) || !isEngineGameState(value.engine)) return false;
    if (!Array.isArray(value.events) || !value.events.every(isLocalGameEventRecord)) return false;
    return hasHistoryIndex(value, value.events.length);
}

export async function loadGameState(
    db: Promise<IDBPDatabase<FootballDB>> = openGameDB(),
): Promise<LiveLocalGameState | null> {
    const database = await db;
    const raw = await database.get(SAVE_STORE_NAME, SAVE_RECORD_KEY);
    if (!isValidPersistedGameState(raw)) return null;
    return {setup: raw.setup, engine: raw.engine, historyIndex: raw.historyIndex, events: raw.events};
}

export async function saveGameState(
    state: LiveLocalGameState,
    db: Promise<IDBPDatabase<FootballDB>> = openGameDB(),
    now = new Date(),
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
    db: Promise<IDBPDatabase<FootballDB>> = openGameDB(),
): Promise<void> {
    const database = await db;
    await database.delete(SAVE_STORE_NAME, SAVE_RECORD_KEY);
}
