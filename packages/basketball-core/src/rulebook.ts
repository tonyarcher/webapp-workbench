import type { BonusRule, CourtSpec, Rulebook, RulebookId, TeamId } from './types';

const HOOP_FROM_BASELINE = 5.25;
const COURT_WIDTH = 50;
const RESTRICTED = 4;
const FT_LINE = 19;
const BACKBOARD = 4;
const FIBA_ARC = 22 + 1.75 / 12;
const NBA_ARC = 23 + 9 / 12;
const NCAA_CORNER = 21 + 8 / 12;
const HS_ARC = 19 + 9 / 12;

function court(
    overrides: Partial<CourtSpec> &
        Pick<
            CourtSpec,
            'length' | 'threeArcRadius' | 'threeCornerDistance' | 'threeCornerSidelineOffset' | 'laneWidth'
        >,
): CourtSpec {
    return {
        width: COURT_WIDTH,
        hoopFromBaseline: HOOP_FROM_BASELINE,
        restrictedRadius: RESTRICTED,
        ftLineFromBaseline: FT_LINE,
        backboardFromBaseline: BACKBOARD,
        ...overrides,
    };
}

const PERIOD_BONUS: BonusRule = { kind: 'period', doubleAt: 5 };
const HALF_BONUS: BonusRule = { kind: 'half', oneAndOneAt: 7, doubleAt: 10 };

export const NFHS: Rulebook = {
    id: 'nfhs',
    label: 'High School',
    court: court({
        length: 84,
        threeArcRadius: HS_ARC,
        threeCornerDistance: HS_ARC,
        threeCornerSidelineOffset: 5.25,
        laneWidth: 12,
    }),
    periodLengthSeconds: 480,
    regulationPeriods: 4,
    shotClockSeconds: 35,
    shotClockOrebSeconds: 35,
    timeoutsPerGame: 5,
    foulOut: 5,
    bonus: HALF_BONUS,
    otLengthSeconds: 240,
};

export const NCAA: Rulebook = {
    id: 'ncaa',
    label: 'College',
    court: court({
        length: 94,
        threeArcRadius: FIBA_ARC,
        threeCornerDistance: NCAA_CORNER,
        threeCornerSidelineOffset: 3 + 4 / 12,
        laneWidth: 12,
    }),
    periodLengthSeconds: 1200,
    regulationPeriods: 2,
    shotClockSeconds: 30,
    shotClockOrebSeconds: 20,
    timeoutsPerGame: 4,
    foulOut: 5,
    bonus: HALF_BONUS,
    otLengthSeconds: 300,
};

export const NBA: Rulebook = {
    id: 'nba',
    label: 'NBA',
    court: court({
        length: 94,
        threeArcRadius: NBA_ARC,
        threeCornerDistance: 22,
        threeCornerSidelineOffset: 3,
        laneWidth: 16,
    }),
    periodLengthSeconds: 720,
    regulationPeriods: 4,
    shotClockSeconds: 24,
    shotClockOrebSeconds: 14,
    timeoutsPerGame: 7,
    foulOut: 6,
    bonus: PERIOD_BONUS,
    otLengthSeconds: 300,
};

export const WNBA: Rulebook = {
    id: 'wnba',
    label: 'WNBA',
    court: court({
        length: 94,
        threeArcRadius: FIBA_ARC,
        threeCornerDistance: 22,
        threeCornerSidelineOffset: 3,
        laneWidth: 16,
    }),
    periodLengthSeconds: 600,
    regulationPeriods: 4,
    shotClockSeconds: 24,
    shotClockOrebSeconds: 14,
    timeoutsPerGame: 4,
    foulOut: 5,
    bonus: PERIOD_BONUS,
    otLengthSeconds: 300,
};

export const RULEBOOKS: Record<RulebookId, Rulebook> = {
    nfhs: NFHS,
    ncaa: NCAA,
    nba: NBA,
    wnba: WNBA,
};

export function getRulebook(id: RulebookId): Rulebook {
    return RULEBOOKS[id];
}

export function oppositeTeam(team: TeamId): TeamId {
    return team === 'home' ? 'away' : 'home';
}

export function bonusKind(rulebook: Rulebook, teamFouls: number): 'none' | 'one-and-one' | 'double' {
    if (rulebook.bonus.kind === 'period') {
        return teamFouls >= rulebook.bonus.doubleAt ? 'double' : 'none';
    }
    if (teamFouls >= rulebook.bonus.doubleAt) return 'double';
    if (teamFouls >= rulebook.bonus.oneAndOneAt) return 'one-and-one';
    return 'none';
}

export function periodLabel(period: number, regulationPeriods: number): string {
    if (period > regulationPeriods) {
        const ot = period - regulationPeriods;
        return ot === 1 ? 'OT' : `${ot}OT`;
    }
    if (regulationPeriods === 2) return period === 1 ? '1st' : '2nd';
    return `Q${period}`;
}

export function isHalfTime(period: number, regulationPeriods: number): boolean {
    return period === regulationPeriods / 2;
}
