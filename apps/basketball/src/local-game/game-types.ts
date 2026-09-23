import type { GameSetup, ScoringEvent } from 'basketball-core';
import type { SimRatings } from '../sim/types';

export interface LocalGameEventRecord {
    id: number;
    occurredAt: string;
    event: ScoringEvent;
}

export type LocalGameMode = 'score' | 'watch';

export type LocalGameSetup = GameSetup & {
    mode?: LocalGameMode;
    simSeed?: number;
    simRatings?: Record<string, SimRatings>;
};

export const DEFAULT_GAME_SETUP: LocalGameSetup = {
    homeName: 'Home',
    awayName: 'Away',
    rulebookId: 'nba',
    openingPossession: 'away',
    mode: 'score',
};
