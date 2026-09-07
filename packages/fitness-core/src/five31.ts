import type {DisplayUnit, LiftId, MainSetSpec, PlannedSet, SetSlot, TemplateId, WeekKind} from './types';
import {LB_TO_KG, kgToLb, roundLoadKg} from './units';

export const LIFTS: LiftId[] = ['squat', 'bench', 'deadlift', 'press'];

export const WEEK_ORDER: WeekKind[] = ['5s', '3s', '531', 'deload'];

/** Training max is 90% of a tested 1RM (Wendler). */
export function trainingMax(oneRmKg: number): number {
    return oneRmKg * 0.9;
}

/** Epley: 1RM = w * (1 + r/30). A single is the 1RM. */
export function epley1rm(weightKg: number, reps: number): number {
    if (reps <= 1) return weightKg;
    return weightKg * (1 + reps / 30);
}

export const WEEK_SETS: Record<WeekKind, MainSetSpec[]> = {
    '5s': [
        {pct: 0.65, reps: 5, amrap: false},
        {pct: 0.75, reps: 5, amrap: false},
        {pct: 0.85, reps: 5, amrap: true},
    ],
    '3s': [
        {pct: 0.7, reps: 3, amrap: false},
        {pct: 0.8, reps: 3, amrap: false},
        {pct: 0.9, reps: 3, amrap: true},
    ],
    '531': [
        {pct: 0.75, reps: 5, amrap: false},
        {pct: 0.85, reps: 3, amrap: false},
        {pct: 0.95, reps: 1, amrap: true},
    ],
    deload: [
        {pct: 0.4, reps: 5, amrap: false},
        {pct: 0.5, reps: 5, amrap: false},
        {pct: 0.6, reps: 5, amrap: false},
    ],
};

export const WARMUP_SETS: MainSetSpec[] = [
    {pct: 0.4, reps: 5, amrap: false},
    {pct: 0.5, reps: 5, amrap: false},
    {pct: 0.6, reps: 3, amrap: false},
];

export const TM_BUMP_LB: Record<LiftId, number> = {
    squat: 10,
    deadlift: 10,
    bench: 5,
    press: 5,
};

export function bumpTmKg(tmKg: number, lift: LiftId): number {
    return tmKg + TM_BUMP_LB[lift] * LB_TO_KG;
}

export function weekKindFromCycleWeek(week: number): WeekKind {
    const i = ((week - 1) % 4 + 4) % 4;
    return WEEK_ORDER[i] ?? '5s';
}

export interface TemplateInfo {
    id: TemplateId;
    label: string;
    assistanceNote: string;
}

export const TEMPLATES: TemplateInfo[] = [
    {id: 'bbb', label: 'Boring But Big', assistanceNote: '5×10 @ 50% TM on the same lift'},
    {id: 'fsl', label: 'First Set Last', assistanceNote: '5×5 @ first work-set percentage'},
    {id: 'ssl', label: 'Second Set Last', assistanceNote: '5×5 @ second work-set percentage'},
    {id: '5s-pro', label: '5s PRO', assistanceNote: 'Main sets of 5, no AMRAP; then FSL 5×5'},
    {id: 'widowmaker', label: 'Widowmaker', assistanceNote: '1×20 @ 50% TM after mains'},
    {id: 'triumvirate', label: 'Triumvirate', assistanceNote: 'Two assistance moves, 5×10 each'},
    {id: 'bbb-beefcake', label: 'BBB Beefcake', assistanceNote: 'BBB 5×10 @ 60% TM'},
    {id: 'bbs', label: 'Boring But Strong', assistanceNote: '5×10 @ 50–70% TM, building weekly'},
    {id: 'bodyweight', label: 'Bodyweight', assistanceNote: 'Chins / push-ups / lunges as assistance'},
];

function firstWorkPct(week: WeekKind): number {
    return WEEK_SETS[week][0]?.pct ?? 0.65;
}

function secondWorkPct(week: WeekKind): number {
    return WEEK_SETS[week][1]?.pct ?? 0.75;
}

function pushSpecs(
    out: PlannedSet[],
    lift: LiftId,
    slot: SetSlot,
    tmKg: number,
    specs: Array<{pct: number; reps: number; amrap: boolean}>,
    display: DisplayUnit,
): void {
    for (let i = 0; i < specs.length; i++) {
        const spec = specs[i];
        if (!spec) continue;
        out.push({
            lift,
            slot,
            setIndex: i + 1,
            pct: spec.pct,
            reps: spec.reps,
            amrap: spec.amrap,
            weightKg: roundLoadKg(tmKg * spec.pct, display),
        });
    }
}

const BBS_PCT: Record<WeekKind, number> = { '5s': 0.5, '3s': 0.6, '531': 0.7, deload: 0.4 };

const ASSIST_FIXED: Partial<Record<TemplateId, Array<{slot: SetSlot; pct: number; reps: number; sets: number}>>> = {
    bbb: [{slot: 'bbb', pct: 0.5, reps: 10, sets: 5}],
    'bbb-beefcake': [{slot: 'bbb', pct: 0.6, reps: 10, sets: 5}],
    widowmaker: [{slot: 'widowmaker', pct: 0.5, reps: 20, sets: 1}],
};

function assistanceSets(template: TemplateId, week: WeekKind): Array<{slot: SetSlot; pct: number; reps: number; sets: number}> {
    if (template === 'bbs') return [{slot: 'bbb', pct: BBS_PCT[week], reps: 10, sets: 5}];
    if (template === 'fsl' || template === '5s-pro') return [{slot: 'fsl', pct: firstWorkPct(week), reps: 5, sets: 5}];
    if (template === 'ssl') return [{slot: 'ssl', pct: secondWorkPct(week), reps: 5, sets: 5}];
    return ASSIST_FIXED[template] ?? [];
}

function mainSpecs(week: WeekKind, template: TemplateId): MainSetSpec[] {
    if (template !== '5s-pro' || week === 'deload') return WEEK_SETS[week];
    return WEEK_SETS[week].map((spec) => ({pct: spec.pct, reps: 5, amrap: false}));
}

export function planLift(options: {
    lift: LiftId;
    tmKg: number;
    week: WeekKind;
    template: TemplateId;
    display: DisplayUnit;
    includeWarmup?: boolean;
}): PlannedSet[] {
    const {lift, tmKg, week, template, display} = options;
    const out: PlannedSet[] = [];
    if (options.includeWarmup !== false && week !== 'deload') {
        pushSpecs(out, lift, 'warmup', tmKg, WARMUP_SETS, display);
    }
    pushSpecs(out, lift, 'main', tmKg, mainSpecs(week, template), display);
    if (week === 'deload') return out;
    for (const block of assistanceSets(template, week)) {
        const specs = Array.from({length: block.sets}, () => ({pct: block.pct, reps: block.reps, amrap: false}));
        pushSpecs(out, lift, block.slot, tmKg, specs, display);
    }
    return out;
}

const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const LB_PLATES = [45, 35, 25, 10, 5, 2.5];

/** Plates per side to load `weight` on a bar. Leftover (unplateable) is ignored. */
export function platesPerSide(
    weight: number,
    bar: number,
    plates: number[],
): number[] {
    let remain = (weight - bar) / 2;
    if (remain <= 0) return [];
    const out: number[] = [];
    for (const plate of plates) {
        while (remain + 1e-9 >= plate) {
            out.push(plate);
            remain -= plate;
        }
    }
    return out;
}

export function platesForLoad(weightKg: number, display: DisplayUnit): {bar: number; plates: number[]; unit: DisplayUnit} {
    if (display === 'lb') {
        const lb = kgToLb(weightKg);
        return {bar: 45, plates: platesPerSide(lb, 45, LB_PLATES), unit: 'lb'};
    }
    return {bar: 20, plates: platesPerSide(weightKg, 20, KG_PLATES), unit: 'kg'};
}
