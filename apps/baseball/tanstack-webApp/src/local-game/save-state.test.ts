import { describe, expect, it } from 'vitest';
import { createGame } from './rule-engine';
import type { EngineInitOptions } from './rule-engine';
import type { LiveLocalGameState } from '../App';
import {
  SAVE_STORAGE_KEY,
  SAVE_STATE_VERSION,
  clearGameState,
  deserializeGameState,
  loadGameState,
  persistGameState,
  serializeGameState,
} from './save-state';
import type { GameStateStore } from './save-state';
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
    events: [
      { id: 1, eventType: 'STRIKE', occurredAt: '2026-08-01T00:00:00.000Z', detail: {} },
      { id: 2, eventType: 'SINGLE', occurredAt: '2026-08-01T00:00:01.000Z', detail: { base: 1 } },
    ] as LocalGameEventRecord[],
  };
}

class InMemoryStore implements GameStateStore {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe('serializeGameState', () => {
  it('produces a JSON string with the schema version and savedAt', () => {
    const raw = serializeGameState(sampleGame(), new Date('2026-08-01T00:00:00.000Z'));
    const parsed = JSON.parse(raw) as { version: number; savedAt: string };
    expect(parsed.version).toBe(SAVE_STATE_VERSION);
    expect(parsed.savedAt).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('deserializeGameState', () => {
  it('round-trips a game state', () => {
    const game = sampleGame();
    const restored = deserializeGameState(serializeGameState(game));
    expect(restored).toEqual(game);
  });

  it('returns null for null input', () => {
    expect(deserializeGameState(null)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(deserializeGameState('{not json')).toBeNull();
  });

  it('returns null for an object without the expected version', () => {
    expect(deserializeGameState('{"version":99,"savedAt":"x","setup":{},"engine":{},"events":[]}')).toBeNull();
  });

  it('returns null when setup is malformed', () => {
    const game = sampleGame();
    const raw = serializeGameState(game);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed.setup = { homeTeamName: 42 };
    expect(deserializeGameState(JSON.stringify(parsed))).toBeNull();
  });

  it('returns null when engine is malformed', () => {
    const game = sampleGame();
    const raw = serializeGameState(game);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed.engine = { inning: 'one' };
    expect(deserializeGameState(JSON.stringify(parsed))).toBeNull();
  });

  it('returns null when events is not an array of records', () => {
    const game = sampleGame();
    const raw = serializeGameState(game);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed.events = 'not-an-array';
    expect(deserializeGameState(JSON.stringify(parsed))).toBeNull();
  });
});

describe('loadGameState', () => {
  it('returns the saved game when a valid envelope is stored', () => {
    const store = new InMemoryStore();
    const game = sampleGame();
    store.setItem(SAVE_STORAGE_KEY, serializeGameState(game));
    expect(loadGameState(store)).toEqual(game);
  });

  it('returns null when nothing is stored', () => {
    expect(loadGameState(new InMemoryStore())).toBeNull();
  });

  it('returns null when the stored value is not valid JSON', () => {
    const store = new InMemoryStore();
    store.setItem(SAVE_STORAGE_KEY, 'garbage');
    expect(loadGameState(store)).toBeNull();
  });

  it('returns null when no store is available', () => {
    expect(loadGameState(null)).toBeNull();
  });
});

describe('persistGameState / clearGameState', () => {
  it('writes the serialized game under the storage key', () => {
    const store = new InMemoryStore();
    const game = sampleGame();
    persistGameState(game, store);
    expect(deserializeGameState(store.getItem(SAVE_STORAGE_KEY))).toEqual(game);
  });

  it('clears the stored game', () => {
    const store = new InMemoryStore();
    const game = sampleGame();
    persistGameState(game, store);
    clearGameState(store);
    expect(store.getItem(SAVE_STORAGE_KEY)).toBeNull();
  });

  it('does not throw when no store is available', () => {
    expect(() => {
      persistGameState(sampleGame(), null);
      clearGameState(null);
    }).not.toThrow();
  });
});
