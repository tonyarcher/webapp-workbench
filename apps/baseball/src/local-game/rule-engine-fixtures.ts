import { createGame, reduceGame } from './rule-engine';
import type { EngineGameState, ScoringEvent, ScoringEventType } from './rule-engine';
import { DEFAULT_AWAY_LINEUP, DEFAULT_HOME_LINEUP } from './default-lineups';

export function createDefaultGame(totalInnings = 9): EngineGameState {
    return createGame({
        homeName: 'Chicago Cubs',
        awayName: 'St. Louis Cardinals',
        homeLineup: DEFAULT_HOME_LINEUP,
        awayLineup: DEFAULT_AWAY_LINEUP,
        totalInnings,
    });
}

export function apply(game: EngineGameState, ...events: ScoringEvent[]): EngineGameState {
    return events.reduce((current, event) => reduceGame(current, event), game);
}

export function event(type: ScoringEventType): ScoringEvent {
    return { type };
}
