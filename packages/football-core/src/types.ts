export type RulebookId = 'nfl' | 'ncaa' | 'nfhs-mn' | 'nfhs-co';

export type TeamId = 'home' | 'away';

export type HashMark = 'left' | 'middle' | 'right';

export type PlayerUnit = 'offense' | 'defense' | 'special';

export type PlayFamily =
    | 'scrimmage'
    | 'kickoff'
    | 'punt'
    | 'field_goal'
    | 'extra_point'
    | 'two_point'
    | 'kneel'
    | 'spike'
    | 'penalty'
    | 'timeout'
    | 'period_end';

export type PlayConcept =
    | 'inside_zone'
    | 'outside_zone'
    | 'power'
    | 'draw'
    | 'qb_sneak'
    | 'screen'
    | 'flea_flicker'
    | 'slant'
    | 'go'
    | 'out'
    | 'rpo'
    | 'dropback'
    | 'play_action'
    | 'scramble'
    | 'unknown';

export type PlayEventKind =
    | 'snap'
    | 'handoff'
    | 'pass'
    | 'catch'
    | 'incomplete'
    | 'interception'
    | 'lateral'
    | 'run'
    | 'fumble'
    | 'recovery'
    | 'tackle'
    | 'sack'
    | 'score'
    | 'out_of_bounds'
    | 'spike'
    | 'kneel'
    | 'penalty';

export type TacklerRole = 'solo' | 'assist' | 'missed';

export type ClockStopReason =
    | 'incomplete'
    | 'out_of_bounds'
    | 'first_down'
    | 'score'
    | 'timeout'
    | 'penalty'
    | 'injury'
    | 'two_minute_warning'
    | 'period_end'
    | 'change_of_possession'
    | 'fourth_down'
    | 'try'
    | 'none';

export type ScoringKind = 'touchdown' | 'field_goal' | 'safety' | 'extra_point' | 'two_point';

export type TurnoverKind = 'interception' | 'fumble' | 'downs' | 'muff';

export type DriveResult = 'td' | 'fg' | 'punt' | 'downs' | 'turnover' | 'end_half' | 'safety' | 'kneel';

export type FirstDownClock = 'always' | 'two-minute' | 'never';

export type OvertimeKind = 'nfl-2024' | 'ncaa' | 'kansas-10';

export interface Player {
    id: string;
    name: string;
    jersey: number;
    position: string;
    unit: PlayerUnit;
}

export interface TeamSide {
    id: TeamId;
    name: string;
    roster: Player[];
}

export interface MercyRule {
    margin: number;
    /** 1-based period when mercy can start (4 = Q4 only). */
    startPeriod: number;
    /** If true, running clock stays even after the margin drops. */
    sticky: boolean;
    /** Resume normal timing when margin falls below this. Ignored if sticky. */
    resumeBelow?: number;
    stopReasons: ClockStopReason[];
}

export interface OvertimeRules {
    kind: OvertimeKind;
    /** Yards from the opponent end zone to start a series. */
    startYardline100: number;
    /** NFL regular-season OT length; 0 means untimed possessions. */
    periodSeconds: number;
}

export interface Rulebook {
    id: RulebookId;
    label: string;
    playerCount: 11;
    quarterLengthSeconds: number;
    regulationPeriods: 4;
    timeoutsPerHalf: 3;
    twoMinuteWarning: boolean;
    firstDownClock: FirstDownClock;
    clockStopsOnFourthDown: boolean;
    kickoffYardline: number;
    touchbackYardline: number;
    extraPointYardline100: number;
    hashStyle: 'nfl' | 'ncaa' | 'nfhs';
    dpi: 'spot' | 'fifteen-cap';
    overtime: OvertimeRules;
    tryIsUntimed: boolean;
    mercy?: MercyRule;
}

export interface Timeouts {
    home: number;
    away: number;
}

export interface ClockState {
    period: number;
    gameClockSeconds: number;
    playClockSeconds: number;
    running: boolean;
    untimed: boolean;
    twoMinuteWarnedThisHalf: boolean;
    mercyActive: boolean;
}

export interface Situation {
    down: 1 | 2 | 3 | 4;
    distance: number;
    /** Yards to the opponent end zone (nflfastR yardline_100). Own 30 === 70. */
    yardline100: number;
    hash: HashMark;
    possession: TeamId;
}

export interface Personnel {
    offense: string[];
    defense: string[];
    grouping: string;
}

export interface PlayEvent {
    kind: PlayEventKind;
    playerId?: string;
    yardline100?: number;
    yards?: number;
}

export interface Tackler {
    playerId: string;
    role: TacklerRole;
}

export interface PlayResult {
    yards: number;
    firstDown: boolean;
    scoring?: ScoringKind;
    turnover?: TurnoverKind;
    deadAtYardline100: number;
    outOfBounds: boolean;
    incomplete: boolean;
    sack: boolean;
}

export interface PlayClockInfo {
    snap: number;
    dead: number;
    playClockAtSnap: number;
    stopReason: ClockStopReason;
}

export interface PlayCall {
    family: PlayFamily;
    concept: PlayConcept;
    formation: string;
}

export interface Play {
    id: string;
    driveId: string;
    period: number;
    clock: PlayClockInfo;
    situation: Situation;
    personnel: Personnel;
    call: PlayCall;
    events: PlayEvent[];
    result: PlayResult;
    tacklers: Tackler[];
}

export interface Drive {
    id: string;
    team: TeamId;
    startPeriod: number;
    startClock: number;
    startYardline100: number;
    playIds: string[];
    result?: DriveResult;
}

export interface ScoreState {
    home: number;
    away: number;
}

export interface GameState {
    rulebookId: RulebookId;
    home: TeamSide;
    away: TeamSide;
    receivingTeam: TeamId;
    clock: ClockState;
    situation: Situation;
    timeouts: Timeouts;
    score: ScoreState;
    personnel: Personnel;
    drives: Drive[];
    plays: Play[];
    pendingTry: boolean;
    tryTeam: TeamId | null;
    kickoffPending: boolean;
    over: boolean;
    nextPlayId: number;
    nextDriveId: number;
}

export interface GameSetup {
    homeName: string;
    awayName: string;
    rulebookId: RulebookId;
    receivingTeam: TeamId;
    homeRoster?: Player[];
    awayRoster?: Player[];
}

export interface PlayInput {
    family: PlayFamily;
    concept?: PlayConcept;
    formation?: string;
    snapClock: number;
    deadClock: number;
    playClockAtSnap?: number;
    yards?: number;
    incomplete?: boolean;
    outOfBounds?: boolean;
    sack?: boolean;
    scramble?: boolean;
    touchdown?: boolean;
    safety?: boolean;
    interception?: boolean;
    fumbleLost?: boolean;
    fumbleOwn?: boolean;
    fieldGoalMade?: boolean;
    extraPointMade?: boolean;
    twoPointMade?: boolean;
    touchback?: boolean;
    tacklers?: Tackler[];
    events?: PlayEvent[];
    passerId?: string;
    rusherId?: string;
    receiverId?: string;
    intendedId?: string;
    hash?: HashMark;
}

export type ScoringEvent =
    | {type: 'set_personnel'; personnel: Personnel}
    | {type: 'timeout'; team: TeamId}
    | {type: 'play'; input: PlayInput}
    | {type: 'period_end'}
    | {type: 'penalty'; team: TeamId; yards: number; accepted: boolean; foul: string};

export const SCORING_EVENT_TYPES = ['set_personnel', 'timeout', 'play', 'period_end', 'penalty'] as const;

export type ScoringEventType = (typeof SCORING_EVENT_TYPES)[number];
