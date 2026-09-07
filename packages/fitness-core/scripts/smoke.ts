import {
    bmi,
    bumpTmKg,
    dotsScore,
    downsampleLttb,
    dueMeasurements,
    epley1rm,
    evaluateThreshold,
    KCAL_TO_J,
    kgToLb,
    lbToKg,
    looksLikeSqlite,
    navyBodyFat,
    parseHealthConnectSqliteTables,
    parseImportText,
    parseSampleCsv,
    phaseOverlapsRange,
    planLift,
    platesPerSide,
    roundLoadKg,
    toSi,
    trainingMax,
    waistToHeight,
    weekKindFromCycleWeek,
} from '../src/index';
import {parseHealthConnectJson} from '../src/health-connect';

function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`ok: ${msg}`);
}

assert(Math.abs(lbToKg(10) - 4.5359237) < 1e-9, '10 lb to kg');
assert(Math.abs(kgToLb(lbToKg(180)) - 180) < 1e-9, 'lb round-trip');
assert(toSi('body_mass', 180, 'lb') != null, 'toSi lb mass');
assert(Math.abs((toSi('body_mass', 180, 'lb') ?? 0) - lbToKg(180)) < 1e-9, '180 lb → kg');
assert(toSi('waist', 32, 'in') != null, 'toSi inch length');
assert(toSi('body_mass', 80, 'stone') == null, 'unknown unit rejected');

assert(Math.abs(trainingMax(200) - 180) < 1e-9, 'TM is 90%');
assert(Math.abs(epley1rm(100, 1) - 100) < 1e-9, 'epley single');
assert(Math.abs(epley1rm(100, 5) - 100 * (1 + 5 / 30)) < 1e-9, 'epley 5 reps');
assert(weekKindFromCycleWeek(1) === '5s', 'week 1 is 5s');
assert(weekKindFromCycleWeek(3) === '531', 'week 3 is 531');
assert(weekKindFromCycleWeek(4) === 'deload', 'week 4 deload');
assert(weekKindFromCycleWeek(5) === '5s', 'week 5 wraps');

{
    const tmKg = lbToKg(180);
    const sets = planLift({lift: 'bench', tmKg, week: '5s', template: 'bbb', display: 'lb', includeWarmup: false});
    const mains = sets.filter((s) => s.slot === 'main');
    assert(mains.length === 3, '3 main sets');
    assert(Math.abs(kgToLb(mains[0]!.weightKg) - 115) < 1e-6, '65% of 180 → 115 lb');
    assert(mains[2]!.amrap === true, 'top set AMRAP');
    const bbb = sets.filter((s) => s.slot === 'bbb');
    assert(bbb.length === 5 && bbb[0]!.reps === 10, 'BBB 5×10');
    const deload = planLift({lift: 'bench', tmKg, week: 'deload', template: 'bbb', display: 'lb', includeWarmup: false});
    assert(deload.every((s) => s.slot === 'main'), 'deload has no assistance');
}

{
    const sets = planLift({lift: 'squat', tmKg: 200, week: '5s', template: '5s-pro', display: 'kg', includeWarmup: false});
    const mains = sets.filter((s) => s.slot === 'main');
    assert(mains.every((s) => s.reps === 5 && s.amrap === false), '5s PRO mains are 5s no AMRAP');
}

assert(Math.abs(kgToLb(bumpTmKg(lbToKg(100), 'bench')) - 105) < 1e-6, 'upper TM +5 lb');
assert(Math.abs(kgToLb(bumpTmKg(lbToKg(200), 'squat')) - 210) < 1e-6, 'lower TM +10 lb');

assert(JSON.stringify(platesPerSide(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25])) === JSON.stringify([25, 15]), 'plates 100kg');
assert(roundLoadKg(101, 'kg') === 100, 'round 101 kg to 2.5');

{
    const pct = navyBodyFat({sex: 'male', heightM: 70 * 0.0254, neckM: 16 * 0.0254, waistM: 32 * 0.0254});
    assert(pct != null && Math.abs(pct - 5.025) < 0.05, `navy male ~5% (got ${pct})`);
}
assert(bmi(81, 1.8) != null && Math.abs((bmi(81, 1.8) ?? 0) - 25) < 0.01, 'BMI 25');
assert(waistToHeight(0.8, 1.8) === 0.8 / 1.8, 'WHtR');
{
    const score = dotsScore(700, 100, 'male');
    assert(score != null && score > 0 && Number.isFinite(score), 'DOTS finite');
}

{
    const pts = Array.from({length: 100}, (_, i) => ({t: i, v: Math.sin(i / 10)}));
    const down = downsampleLttb(pts, 10);
    assert(down.length >= 9 && down.length <= 10, 'LTTB length');
    assert(down[0]!.t === 0 && down[down.length - 1]!.t === 99, 'LTTB keeps ends');
    assert(down.every((p, i) => i === 0 || p.t !== down[i - 1]!.t), 'LTTB no adjacent duplicate t');
}

assert(evaluateThreshold(80, 'gt', 75) === true, 'threshold gt');
assert(evaluateThreshold(75, 'gt', 75) === false, 'threshold gt equal');
assert(phaseOverlapsRange('2026-01-01', '2026-02-01', Date.parse('2026-01-15T00:00:00Z'), Date.parse('2026-01-20T00:00:00Z')), 'phase overlap');
assert(!phaseOverlapsRange('2026-03-01', null, Date.parse('2026-01-01T00:00:00Z'), Date.parse('2026-02-01T00:00:00Z')), 'phase no overlap');

{
    const csv = parseSampleCsv('metric,timestamp,value,unit\nweight,2026-01-01T08:00:00Z,180,lb\nwaist,2026-01-01,32,in\nbogus,2026-01-01,1,x\n');
    assert(csv.format === 'csv', 'csv format');
    assert(csv.samples.length === 2, 'csv two samples');
    assert(csv.skipped.length === 1 && csv.skipped[0]!.reason === 'unknown metric', 'csv skip unknown');
    assert(csv.samples[0]!.metric === 'body_mass', 'weight alias');
}

{
    const hc = parseHealthConnectJson([
        {
            recordType: 'WeightRecord',
            startTime: '2026-01-02T08:00:00Z',
            weight: {inKilograms: 82.5},
            id: 'w1',
        },
        {recordType: 'StepsRecord', startTime: '2026-01-02T00:00:00Z', count: 8_000},
        {recordType: 'UnknownRecord', startTime: '2026-01-02T00:00:00Z'},
    ]);
    assert(hc.format === 'health-connect', 'hc format');
    assert(hc.samples.length === 2, 'hc two samples');
    assert(hc.samples[0]!.valueSi === 82.5 && hc.samples[0]!.originId === 'w1', 'hc weight');
    assert(hc.skipped.some((s) => s.reason === 'unknown record type'), 'hc skip unknown');
}

{
    const parsed = parseImportText('metric,timestamp,value,unit\nsteps,2026-01-03T00:00:00Z,1000,count\n');
    assert(parsed.format === 'csv' && parsed.samples[0]!.metric === 'steps', 'detect csv');
}

{
    const due = dueMeasurements({}, Date.UTC(2026, 0, 1), 'male');
    assert(due.some((d) => d.metric === 'neck' && d.stale), 'neck due when missing');
    const hip = due.find((d) => d.metric === 'hip');
    assert(hip != null && !hip.formulaIds.includes('navy-bf'), 'male navy skips hip; WHR still wants it');
}

{
    const magic = new TextEncoder().encode('SQLite format 3\0');
    assert(looksLikeSqlite(magic), 'sqlite magic');
    assert(!looksLikeSqlite(new TextEncoder().encode('{"a":1}')), 'json is not sqlite');
    const uuid = new Uint8Array([0x02, 0xae, 0xb4, 0xaf]);
    const mapped = parseHealthConnectSqliteTables({
        weight_record_table: [{uuid, time: 1_779_756_532_953, weight: 86_182.47985839844}],
        steps_record_table: [{uuid: 'step-1', start_time: 1_000, count: 12}],
        sleep_session_record_table: [{uuid: 'sleep-1', start_time: 0, end_time: 3_600_000}],
        total_calories_burned_record_table: [{uuid: 'kcal-1', start_time: 2_000, energy: 1_000}],
        heart_rate_record_series_table: [
            {epoch_millis: 60_000, beats_per_minute: 80},
            {epoch_millis: 60_500, beats_per_minute: 100},
            {epoch_millis: 120_000, beats_per_minute: 90},
        ],
    });
    assert(mapped.format === 'health-connect-db', 'sqlite format tag');
    const weight = mapped.samples.find((s) => s.metric === 'body_mass');
    assert(weight != null && Math.abs(weight.valueSi - 86.18247985839844) < 1e-9, 'weight grams → kg');
    assert(weight!.originId === '02aeb4af', 'uuid origin is hex');
    const again = parseHealthConnectSqliteTables({
        weight_record_table: [{uuid, time: 1_779_756_532_953, weight: 86_500}],
    });
    assert(again.samples[0]!.originId === weight!.originId, 're-export keeps origin for upsert');
    assert(mapped.samples.find((s) => s.metric === 'steps')?.valueSi === 12, 'steps');
    assert(mapped.samples.find((s) => s.metric === 'sleep')?.valueSi === 3_600, 'sleep seconds');
    const energy = mapped.samples.find((s) => s.metric === 'energy');
    assert(energy != null && Math.abs(energy.valueSi - KCAL_TO_J) < 1e-6, '1000 cal → 1 kcal SI');
    const hr = mapped.samples.filter((s) => s.metric === 'heart_rate').sort((a, b) => a.t - b.t);
    assert(hr.length === 2, 'HR downsampled to minutes');
    assert(hr[0]!.valueSi === 90 && hr[0]!.originId === 'hr-minute:60000', 'HR minute average + stable key');
}

console.log('\nAll fitness-core smoke tests passed.');
