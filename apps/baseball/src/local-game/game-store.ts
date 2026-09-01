import { QueryClient, QueryObserver } from '@tanstack/query-core';
import type { LiveLocalGameState } from './game-state';
import type { LocalGameEventRecord, LocalGameSetup } from './game-types';
import { createGame, reduceGame } from './rule-engine';
import type { EngineGameState, EngineInitOptions, ScoringEvent, ScoringEventType } from './rule-engine';
import { clearGameState, loadGameState, saveGameState } from './save-state';
import {
  DEFAULT_AWAY_LINEUP,
  DEFAULT_AWAY_PITCHER,
  DEFAULT_HOME_LINEUP,
  DEFAULT_HOME_PITCHER,
  lineupPlayersFromUnknown,
  toLineupPlayers,
} from './default-lineups';

export const GAME_QUERY_KEY = ['game'] as const;

export type GameQueryResult = LiveLocalGameState | null | undefined;

const ALL_ENGINE_EVENT_TYPES: ScoringEventType[] = [
  'BALL',
  'STRIKE',
  'FOUL',
  'STRIKEOUT',
  'WALK',
  'HIT_BY_PITCH',
  'SINGLE',
  'DOUBLE',
  'TRIPLE',
  'HOME_RUN',
  'GROUNDOUT',
  'FLYOUT',
  'LINE_OUT',
  'POP_OUT',
  'SACRIFICE_FLY',
  'SACRIFICE_BUNT',
  'ERROR',
  'FIELDER_CHOICE',
  'STOLEN_BASE',
  'CAUGHT_STEALING',
  'WILD_PITCH',
  'PASSED_BALL',
  'BALK',
  'SET_LINEUP',
];

export class GameStore {
  readonly queryClient: QueryClient;
  private observer: QueryObserver<GameQueryResult, Error>;

  constructor(queryClient = new QueryClient()) {
    this.queryClient = queryClient;
    this.observer = new QueryObserver<GameQueryResult, Error>(this.queryClient, {
      queryKey: GAME_QUERY_KEY,
    });
  }

  subscribe(callback: (game: GameQueryResult) => void): () => void {
    callback(this.observer.getCurrentResult().data);
    return this.observer.subscribe((result) => callback(result.data));
  }

  async hydrate(): Promise<void> {
    const saved = await loadGameState();
    this.queryClient.setQueryData(GAME_QUERY_KEY, saved);
  }

  current(): LiveLocalGameState | null {
    return this.queryClient.getQueryData<GameQueryResult>(GAME_QUERY_KEY) ?? null;
  }

  get canUndo(): boolean {
    const state = this.current();
    return state ? state.historyIndex > 0 : false;
  }

  get canRedo(): boolean {
    const state = this.current();
    return state ? state.historyIndex < state.events.length : false;
  }

  startGame(setup: LocalGameSetup): void {
    this.commit({
      setup,
      engine: createGame(buildEngineOptions(setup)),
      historyIndex: 0,
      events: [],
    });
  }

  recordEvent(record: LocalGameEventRecord): void {
    const previous = this.current();
    if (!previous) return;
    const nextEngine = reduceEngineState(previous.engine, record);
    this.commit({
      ...previous,
      engine: nextEngine,
      historyIndex: previous.historyIndex + 1,
      events: [...previous.events.slice(0, previous.historyIndex), record],
    });
  }

  undo(): void {
    this.applyHistory((this.current()?.historyIndex ?? 0) - 1);
  }

  redo(): void {
    this.applyHistory((this.current()?.historyIndex ?? 0) + 1);
  }

  newGame(): void {
    this.queryClient.setQueryData(GAME_QUERY_KEY, null);
    void clearGameState();
  }

  private applyHistory(historyIndex: number): void {
    const state = this.current();
    if (!state) return;
    if (historyIndex < 0 || historyIndex > state.events.length) return;
    const base = createGame(buildEngineOptions(state.setup));
    let engine = base;
    for (const record of state.events.slice(0, historyIndex)) {
      engine = reduceEngineState(engine, record);
    }
    this.commit({ ...state, engine, historyIndex });
  }

  private commit(state: LiveLocalGameState): void {
    this.queryClient.setQueryData(GAME_QUERY_KEY, state);
    void saveGameState(state);
  }
}

function buildEngineOptions(setup: LocalGameSetup): EngineInitOptions {
  const homeLineup = setup.homeLineup?.length ? setup.homeLineup : toLineupPlayers(DEFAULT_HOME_LINEUP);
  const awayLineup = setup.awayLineup?.length ? setup.awayLineup : toLineupPlayers(DEFAULT_AWAY_LINEUP);
  return {
    homeName: setup.homeTeamName,
    awayName: setup.awayTeamName,
    homeLineup,
    awayLineup,
    totalInnings: setup.innings,
    homePitcherName: setup.homePitcherName ?? DEFAULT_HOME_PITCHER,
    awayPitcherName: setup.awayPitcherName ?? DEFAULT_AWAY_PITCHER,
  };
}

function reduceEngineState(engine: EngineGameState, record: LocalGameEventRecord): EngineGameState {
  const scoringEvent = toScoringEvent(record);
  if (!scoringEvent) return engine;
  return reduceGame(engine, scoringEvent);
}

function toScoringEvent(record: LocalGameEventRecord): ScoringEvent | null {
  const eventType = record.eventType as ScoringEventType;
  if (!ALL_ENGINE_EVENT_TYPES.includes(eventType)) return null;
  const event: ScoringEvent = { type: eventType };
  const fieldPos = Number(record.detail?.fieldPos);
  if (Number.isFinite(fieldPos) && fieldPos >= 1 && fieldPos <= 9) {
    event.fieldPos = fieldPos;
  }
  const base = Number(record.detail?.base);
  if (Number.isFinite(base) && base >= 1 && base <= 4) {
    event.base = base;
  }
  if (record.detail?.doublePlay === true) {
    event.doublePlay = true;
  }
  if (eventType === 'SET_LINEUP') {
    event.homeLineup = lineupPlayersFromUnknown(record.detail?.homeLineup);
    event.awayLineup = lineupPlayersFromUnknown(record.detail?.awayLineup);
    event.homePitcherName = optionalString(record.detail?.homePitcherName);
    event.awayPitcherName = optionalString(record.detail?.awayPitcherName);
  }
  return event;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}


