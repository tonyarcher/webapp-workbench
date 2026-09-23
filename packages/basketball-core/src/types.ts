export type RulebookId = 'nfhs' | 'ncaa' | 'nba' | 'wnba';

export type TeamId = 'home' | 'away';

export type Position = 'G' | 'F' | 'C';

export type BonusKind = 'none' | 'one-and-one' | 'double';

export type PeriodBonus = { kind: 'period'; doubleAt: number };

export type HalfBonus = { kind: 'half'; oneAndOneAt: number; doubleAt: number };

export type BonusRule = PeriodBonus | HalfBonus;

export interface CourtSpec {
    length: number;
    width: number;
    hoopFromBaseline: number;
    threeArcRadius: number;
    threeCornerDistance: number;
    threeCornerSidelineOffset: number;
    laneWidth: number;
    restrictedRadius: number;
    ftLineFromBaseline: number;
    backboardFromBaseline: number;
}

export interface Rulebook {
    id: RulebookId;
    label: string;
    court: CourtSpec;
    periodLengthSeconds: number;
    regulationPeriods: number;
    shotClockSeconds: number;
    shotClockOrebSeconds: number;
    timeoutsPerGame: number;
    foulOut: number;
    bonus: BonusRule;
    otLengthSeconds: number;
}

export interface Player {
    id: string;
    name: string;
    jersey: number;
    position: Position;
}

export interface TeamSide {
    id: TeamId;
    name: string;
    roster: Player[];
    onCourt: string[];
    timeouts: number;
}

export interface ClockState {
    period: number;
    gameClockSeconds: number;
    shotClockSeconds: number;
    running: boolean;
}

export interface ClockStamp {
    period: number;
    gameClockSeconds: number;
    shotClockSeconds: number;
}

export interface ScoreState {
    home: number;
    away: number;
}

export interface TeamFouls {
    home: number;
    away: number;
}

export interface ShotMark {
    id: number;
    team: TeamId;
    shooterId: string;
    xFeet: number;
    yFeet: number;
    made: boolean;
    points: 0 | 2 | 3;
    period: number;
    clockSeconds: number;
    assistId?: string;
}

export type StatKey =
    | 'seconds'
    | 'fgm'
    | 'fga'
    | 'tpm'
    | 'tpa'
    | 'ftm'
    | 'fta'
    | 'ast'
    | 'orb'
    | 'drb'
    | 'stl'
    | 'blk'
    | 'tov'
    | 'pf'
    | 'pts';

export interface PlayerStatLine {
    playerId: string;
    seconds: number;
    fgm: number;
    fga: number;
    tpm: number;
    tpa: number;
    ftm: number;
    fta: number;
    ast: number;
    orb: number;
    drb: number;
    stl: number;
    blk: number;
    tov: number;
    pf: number;
    pts: number;
}

export interface PendingFt {
    team: TeamId;
    shooterId: string;
    remaining: number;
    oneAndOne: boolean;
    andOne: boolean;
}

export interface Point {
    x: number;
    y: number;
}

export interface GameState {
    rulebookId: RulebookId;
    home: TeamSide;
    away: TeamSide;
    clock: ClockState;
    possession: TeamId;
    openingPossession: TeamId;
    homeAttacksLeft: boolean;
    score: ScoreState;
    teamFouls: TeamFouls;
    pendingFt: PendingFt | null;
    shots: ShotMark[];
    stats: Record<string, PlayerStatLine>;
    stintStart: Record<string, ClockStamp>;
    over: boolean;
    nextShotId: number;
}

export interface GameSetup {
    homeName: string;
    awayName: string;
    rulebookId: RulebookId;
    openingPossession: TeamId;
    homeRoster?: Player[];
    awayRoster?: Player[];
    homeOnCourt?: string[];
    awayOnCourt?: string[];
}

export type ShotEvent = {
    type: 'shot';
    team: TeamId;
    shooterId: string;
    xFeet: number;
    yFeet: number;
    made: boolean;
    clock: ClockStamp;
    assistId?: string;
    blockedById?: string;
    shootingFoul?: boolean;
};

export type FreeThrowEvent = {
    type: 'free_throw';
    shooterId: string;
    made: boolean;
    clock: ClockStamp;
};

export type ReboundEvent = {
    type: 'rebound';
    team: TeamId;
    playerId: string;
    offensive: boolean;
    clock: ClockStamp;
};

export type TurnoverEvent = {
    type: 'turnover';
    team: TeamId;
    playerId: string;
    clock: ClockStamp;
    stealPlayerId?: string;
};

export type FoulEvent = {
    type: 'foul';
    team: TeamId;
    playerId: string;
    clock: ClockStamp;
    fouledId?: string;
    offensive?: boolean;
    shooting?: boolean;
};

export type SubstitutionEvent = {
    type: 'substitution';
    team: TeamId;
    outId: string;
    inId: string;
};

export type TimeoutEvent = { type: 'timeout'; team: TeamId };

export type PeriodEndEvent = { type: 'period_end' };

export type SetClockEvent = {
    type: 'set_clock';
    clock: ClockStamp;
    running?: boolean;
};

export type SetLineupEvent = {
    type: 'set_lineup';
    team: TeamId;
    onCourt: string[];
};

export type ScoringEvent =
    | ShotEvent
    | FreeThrowEvent
    | ReboundEvent
    | TurnoverEvent
    | FoulEvent
    | SubstitutionEvent
    | TimeoutEvent
    | PeriodEndEvent
    | SetClockEvent
    | SetLineupEvent;

export const SCORING_EVENT_TYPES = [
    'shot',
    'free_throw',
    'rebound',
    'turnover',
    'foul',
    'substitution',
    'timeout',
    'period_end',
    'set_clock',
    'set_lineup',
] as const;

export type ScoringEventType = (typeof SCORING_EVENT_TYPES)[number];
