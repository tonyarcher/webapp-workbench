import type {MercyRule, OvertimeRules, Rulebook, RulebookId} from './types';

const NFHS_MERCY_STOP = ['timeout', 'injury', 'penalty', 'score'] as MercyRule['stopReasons'];

const NFL_OT: OvertimeRules = {kind: 'nfl-2024', startYardline100: 25, periodSeconds: 600};
const NCAA_OT: OvertimeRules = {kind: 'ncaa', startYardline100: 25, periodSeconds: 0};
const KANSAS_OT: OvertimeRules = {kind: 'kansas-10', startYardline100: 10, periodSeconds: 0};

export const NFL: Rulebook = {
    id: 'nfl',
    label: 'NFL',
    playerCount: 11,
    quarterLengthSeconds: 900,
    regulationPeriods: 4,
    timeoutsPerHalf: 3,
    twoMinuteWarning: true,
    firstDownClock: 'two-minute',
    clockStopsOnFourthDown: false,
    kickoffYardline: 35,
    touchbackYardline: 30,
    extraPointYardline100: 15,
    hashStyle: 'nfl',
    dpi: 'spot',
    overtime: NFL_OT,
    tryIsUntimed: true,
};

export const NCAA: Rulebook = {
    id: 'ncaa',
    label: 'NCAA',
    playerCount: 11,
    quarterLengthSeconds: 900,
    regulationPeriods: 4,
    timeoutsPerHalf: 3,
    twoMinuteWarning: false,
    firstDownClock: 'two-minute',
    clockStopsOnFourthDown: false,
    kickoffYardline: 35,
    touchbackYardline: 25,
    extraPointYardline100: 3,
    hashStyle: 'ncaa',
    dpi: 'fifteen-cap',
    overtime: NCAA_OT,
    tryIsUntimed: true,
};

export const NFHS_MN: Rulebook = {
    id: 'nfhs-mn',
    label: 'Minnesota HS (MSHSL)',
    playerCount: 11,
    quarterLengthSeconds: 720,
    regulationPeriods: 4,
    timeoutsPerHalf: 3,
    twoMinuteWarning: false,
    firstDownClock: 'always',
    clockStopsOnFourthDown: true,
    kickoffYardline: 40,
    touchbackYardline: 20,
    extraPointYardline100: 3,
    hashStyle: 'nfhs',
    dpi: 'fifteen-cap',
    overtime: KANSAS_OT,
    tryIsUntimed: true,
    mercy: {
        margin: 35,
        startPeriod: 4,
        sticky: false,
        resumeBelow: 30,
        stopReasons: NFHS_MERCY_STOP,
    },
};

export const NFHS_CO: Rulebook = {
    id: 'nfhs-co',
    label: 'Colorado HS (CHSAA)',
    playerCount: 11,
    quarterLengthSeconds: 720,
    regulationPeriods: 4,
    timeoutsPerHalf: 3,
    twoMinuteWarning: false,
    firstDownClock: 'always',
    clockStopsOnFourthDown: true,
    kickoffYardline: 40,
    touchbackYardline: 20,
    extraPointYardline100: 3,
    hashStyle: 'nfhs',
    dpi: 'fifteen-cap',
    overtime: KANSAS_OT,
    tryIsUntimed: true,
    mercy: {
        margin: 40,
        startPeriod: 1,
        sticky: true,
        stopReasons: NFHS_MERCY_STOP,
    },
};

export const RULEBOOKS: Record<RulebookId, Rulebook> = {
    nfl: NFL,
    ncaa: NCAA,
    'nfhs-mn': NFHS_MN,
    'nfhs-co': NFHS_CO,
};

export function getRulebook(id: RulebookId): Rulebook {
    return RULEBOOKS[id];
}

export function oppositeTeam(team: 'home' | 'away'): 'home' | 'away' {
    return team === 'home' ? 'away' : 'home';
}
