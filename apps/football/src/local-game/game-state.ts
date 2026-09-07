import type {GameState} from 'football-core';
import type {LocalGameEventRecord, LocalGameSetup} from './game-types';

export interface LiveLocalGameState {
    setup: LocalGameSetup;
    engine: GameState;
    historyIndex: number;
    events: LocalGameEventRecord[];
}
