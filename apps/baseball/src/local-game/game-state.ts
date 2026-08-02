import type { EngineGameState } from './rule-engine';
import type { LocalGameEventRecord, LocalGameSetup } from './game-types';

export interface LiveLocalGameState {
  setup: LocalGameSetup;
  engine: EngineGameState;
  historyIndex: number;
  events: LocalGameEventRecord[];
}
