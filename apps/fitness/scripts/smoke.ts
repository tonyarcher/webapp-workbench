import {parseImportText, planLift, lbToKg} from 'fitness-core';

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

console.log('\nAll fitness smoke tests passed.');
