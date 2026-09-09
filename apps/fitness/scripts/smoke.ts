import {parseImportText, parseHealthConnectSqliteTables, planLift, lbToKg} from 'fitness-core';
import {formatLog} from '../server/log.ts';
import {rowObject, rowsFromExec} from '../src/services/sqlite-rows';
import {displaySeries, rollupPoints} from '../src/services/chart-data';

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) throw new Error(`FAIL: ${msg}`);
    console.log(`ok: ${msg}`);
}

const csv = parseImportText('metric,timestamp,value,unit\nweight,2026-01-01T08:00:00Z,80,kg\n');
assert(csv.samples.length === 1, 'csv import one sample');
assert(csv.samples[0]!.metric === 'body_mass', 'weight maps to body_mass');

const hc = parseImportText(JSON.stringify({
    recordType: 'WeightRecord',
    startTime: '2026-01-02T08:00:00Z',
    weight: {inKilograms: 81},
    id: 'w-smoke',
}));
assert(hc.samples.length === 1 && hc.samples[0]!.originId === 'w-smoke', 'hc single record object');

const wrapped = parseImportText(JSON.stringify([
    {recordType: 'WeightRecord', startTime: '2026-01-02T08:00:00Z', weight: {inKilograms: 81}, id: 'w-smoke'},
]));
assert(wrapped.samples.length === 1 && wrapped.samples[0]!.originId === 'w-smoke', 'hc array via parseImportText');

const sets = planLift({lift: 'press', tmKg: lbToKg(100), week: '531', template: 'fsl', display: 'lb', includeWarmup: true});
assert(sets.some((s) => s.slot === 'warmup'), 'warmup present');
assert(sets.filter((s) => s.slot === 'fsl').length === 5, 'FSL 5 sets');

{
    const row = rowObject(['uuid', 'time', 'weight'], [new Uint8Array([1, 2]), 1_000, 80_000]);
    assert(row.time === 1_000 && row.weight === 80_000, 'sqlite rowObject');
    const rows = rowsFromExec(() => [{columns: ['count'], values: [[12]]}], 'steps_record_table');
    assert(rows.length === 1 && rows[0]!.count === 12, 'sqlite rowsFromExec');
    const empty = rowsFromExec(() => {
        throw new Error('no such table');
    }, 'missing');
    assert(empty.length === 0, 'missing table yields no rows');
    const mapped = parseHealthConnectSqliteTables({});
    assert(mapped.skipped.some((s) => s.reason === 'no mapped records'), 'empty db is explained');
}

{
    const rows = [
        {metric: 'waist', day: '2026-01-01', minSi: 0.8, maxSi: 0.8, avgSi: 0.8, sumSi: 0.8, n: 1},
        {metric: 'waist', day: '2026-01-02', minSi: 0.79, maxSi: 0.79, avgSi: 0.79, sumSi: 0.79, n: 1},
    ];
    const pts = rollupPoints(rows, 'waist', 'avg');
    assert(pts.length === 2 && pts[0]!.v === 0.8, 'rollup points');
    const shown = displaySeries('waist', pts, 'kg');
    assert(shown.ys.length === 2 && shown.fmt === 'cm', 'display series cm');
}

{
    const prev = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'info';
    const line = formatLog('fitness-api', {level: 'info', msg: 'listening', port: 3003});
    assert(!!line && JSON.parse(line).service === 'fitness-api', 'formatLog json');
    process.env.LOG_LEVEL = 'error';
    assert(formatLog('fitness-api', {level: 'debug', msg: 'x'}) === null, 'formatLog level filter');
    if (prev === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = prev;
}

console.log('\nAll fitness smoke tests passed.');
