import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { createGame } from './rule-engine';
import type { EngineInitOptions } from './rule-engine';
import type { LiveLocalGameState } from './game-state';
import {
  SAVE_DB_NAME,
  SAVE_RECORD_KEY,
  SAVE_STATE_VERSION,
  SAVE_STORE_NAME,
  clearGameState,
  isValidPersistedGameState,
  loadGameState,
  openGameDB,
  saveGameState,
} from './save-state';
import type { LocalGameEventRecord } from './game-types';

const ENGINE_OPTIONS: EngineInitOptions = {
  homeName: 'Chicago Cubs',
  awayName: 'St. Louis Cardinals',
  homeLineup: [
    { batterName: 'Nico Hoerner', position: '2B' },
    { batterName: 'Dansby Swanson', position: 'SS' },
  ],
  awayLineup: [
    { batterName: 'Brendan Donovan', position: '2B' },
    { batterName: 'Paul Goldschmidt', position: '1B' },
  ],
  totalInnings: 9,
};

function sampleGame(): LiveLocalGameState {
  return {
    setup: { homeTeamName: 'Chicago Cubs', awayTeamName: 'St. Louis Cardinals', innings: 9 },
    engine: createGame(ENGINE_OPTIONS),
    historyIndex: 2,
    events: [
      { id: 1, eventType: 'STRIKE', occurredAt: '2026-08-01T00:00:00.000Z', detail: {} },
      { id: 2, eventType: 'SINGLE', occurredAt: '2026-08-01T00:00:01.000Z', detail: { base: 1 } },
    ] as LocalGameEventRecord[],
  };
}

async function putRaw(value: unknown) {
  const db = await openGameDB();
  await db.put(SAVE_STORE_NAME, value as never, SAVE_RECORD_KEY);
}

beforeEach(async () => {
  await clearGameState();
});

describe('saveGameState / loadGameState', () => {
  it('round-trips a game state through IndexedDB', async () => {
    const game = sampleGame();
    await saveGameState(game);
    await expect(loadGameState()).resolves.toEqual(game);
  });

  it('stores the record under the expected database, store, and key', async () => {
    await saveGameState(sampleGame(), openGameDB(), new Date('2026-08-01T00:00:00.000Z'));
    const db = await openGameDB();
    const raw = await db.get(SAVE_STORE_NAME, SAVE_RECORD_KEY);
    expect(raw).toBeDefined();
    expect(raw?.version).toBe(SAVE_STATE_VERSION);
    expect(raw?.savedAt).toBe('2026-08-01T00:00:00.000Z');
    expect(db.name).toBe(SAVE_DB_NAME);
  });

  it('returns null when nothing is stored', async () => {
    await expect(loadGameState()).resolves.toBeNull();
  });

  it('clears the stored game', async () => {
    await saveGameState(sampleGame());
    await clearGameState();
    await expect(loadGameState()).resolves.toBeNull();
  });
});

describe('isValidPersistedGameState', () => {
  it('rejects a record without the expected version', async () => {
    const raw = { version: 99, savedAt: 'x', setup: {}, engine: {}, historyIndex: 0, events: [] };
    expect(isValidPersistedGameState(raw)).toBe(false);
    await putRaw(raw);
    await expect(loadGameState()).resolves.toBeNull();
  });

  it('rejects a malformed engine', async () => {
    const game = sampleGame();
    await saveGameState(game);
    const db = await openGameDB();
    const raw = await db.get(SAVE_STORE_NAME, SAVE_RECORD_KEY);
    const parsed = raw ? { ...raw, engine: { inning: 'one' } } : raw;
    await db.put(SAVE_STORE_NAME, parsed as never, SAVE_RECORD_KEY);
    await expect(loadGameState()).resolves.toBeNull();
  });

  it('rejects malformed setup', async () => {
    const game = sampleGame();
    await saveGameState(game);
    const db = await openGameDB();
    const raw = await db.get(SAVE_STORE_NAME, SAVE_RECORD_KEY);
    const parsed = raw ? { ...raw, setup: { homeTeamName: 42 } } : raw;
    await db.put(SAVE_STORE_NAME, parsed as never, SAVE_RECORD_KEY);
    await expect(loadGameState()).resolves.toBeNull();
  });

  it('rejects events that are not an array of records', async () => {
    const game = sampleGame();
    await saveGameState(game);
    const db = await openGameDB();
    const raw = await db.get(SAVE_STORE_NAME, SAVE_RECORD_KEY);
    const parsed = raw ? { ...raw, events: 'not-an-array' } : raw;
    await db.put(SAVE_STORE_NAME, parsed as never, SAVE_RECORD_KEY);
    await expect(loadGameState()).resolves.toBeNull();
  });

  it('rejects a historyIndex that exceeds the number of events', async () => {
    const game = sampleGame();
    await saveGameState(game);
    const db = await openGameDB();
    const raw = await db.get(SAVE_STORE_NAME, SAVE_RECORD_KEY);
    const parsed = raw ? { ...raw, historyIndex: 5 } : raw;
    await db.put(SAVE_STORE_NAME, parsed as never, SAVE_RECORD_KEY);
    await expect(loadGameState()).resolves.toBeNull();
  });
});
