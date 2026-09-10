import type {GameSetup, ScoringEvent} from 'football-core';

export interface LocalGameEventRecord {
    id: number;
    occurredAt: string;
    event: ScoringEvent;
}

export type LocalGameMode = 'score' | 'watch';

export type LocalGameSetup = GameSetup & {
    mode?: LocalGameMode;
    simSeed?: number;
};

export const DEFAULT_GAME_SETUP: LocalGameSetup = {
    homeName: 'Home',
    awayName: 'Away',
    rulebookId: 'nfhs-mn',
    receivingTeam: 'away',
    mode: 'score',
};
