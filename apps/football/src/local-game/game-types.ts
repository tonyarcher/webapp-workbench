import type { GameSetup, ScoringEvent } from '../core/index.js';

export interface LocalGameEventRecord {
    id: number;
    occurredAt: string;
    event: ScoringEvent;
}

export type LocalGameMode = 'score' | 'watch';

export type LocalGameSetup = GameSetup & {
    mode?: LocalGameMode;
    simSeed?: number | undefined;
};

export const DEFAULT_GAME_SETUP: LocalGameSetup = {
    homeName: 'Home',
    awayName: 'Away',
    rulebookId: 'nfhs-mn',
    receivingTeam: 'away',
    mode: 'score',
};
