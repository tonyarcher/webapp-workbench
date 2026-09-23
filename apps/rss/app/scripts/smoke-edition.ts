// Edition smoke: option defaults/validation/pruning, re-ranking weights,
// and edition JSON shape guards.
import { assert } from './smoke-assert';

// ---- edition options: defaults, load/save/validate, prune, re-rank ----
{
    const {
        DEFAULT_EDITION_OPTIONS,
        defaultEditionOptions,
        loadEditionOptions,
        saveEditionOptions,
        pruneEditionOptions,
        applyWeights,
    } = await import('../src/services/edition-options');

    assert(
        DEFAULT_EDITION_OPTIONS.windowHours === 24 &&
            DEFAULT_EDITION_OPTIONS.sectionCount === 12 &&
            DEFAULT_EDITION_OPTIONS.weightGeneral === 0.3 &&
            DEFAULT_EDITION_OPTIONS.weightPersonal === 0.3 &&
            DEFAULT_EDITION_OPTIONS.weightNewness === 0.25 &&
            DEFAULT_EDITION_OPTIONS.weightPopularity === 0.15 &&
            DEFAULT_EDITION_OPTIONS.showOpinion &&
            DEFAULT_EDITION_OPTIONS.showFactCheck,
        'edition options defaults match the server ranker',
    );
    assert(
        JSON.stringify(defaultEditionOptions()) === JSON.stringify(DEFAULT_EDITION_OPTIONS),
        'defaultEditionOptions matches DEFAULT_EDITION_OPTIONS',
    );

    const shims = globalThis as Record<string, unknown>;
    const realLS = shims['localStorage'];
    const mem = new Map<string, string>();
    shims['localStorage'] = {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, String(v)),
        removeItem: (k: string) => void mem.delete(k),
    };
    try {
        saveEditionOptions({ ...DEFAULT_EDITION_OPTIONS, sectionCount: 7, showOpinion: false });
        const roundTrip = loadEditionOptions();
        assert(roundTrip.sectionCount === 7, 'edition options save/load round trip keeps section count');
        assert(roundTrip.showOpinion === false, 'edition options save/load round trip keeps opinion toggle');
        assert(roundTrip.weightGeneral === 0.3, 'edition options round trip keeps weights');

        mem.set(
            'rss-reader:edition-options',
            JSON.stringify({
                windowHours: 13,
                sectionCount: 999,
                weightGeneral: -2,
                weightPopularity: Number.NaN,
                showFactCheck: 'yes',
            }),
        );
        const validated = loadEditionOptions();
        assert(
            validated.windowHours === DEFAULT_EDITION_OPTIONS.windowHours,
            'edition options reject an unknown window',
        );
        assert(
            validated.sectionCount === DEFAULT_EDITION_OPTIONS.sectionCount,
            'edition options reject an out-of-range section count',
        );
        assert(
            validated.weightGeneral === DEFAULT_EDITION_OPTIONS.weightGeneral,
            'edition options reject a negative weight',
        );
        assert(
            validated.weightPopularity === DEFAULT_EDITION_OPTIONS.weightPopularity,
            'edition options reject a NaN weight',
        );
        assert(validated.showFactCheck === false, 'edition options keep strict boolean toggles');

        mem.set('rss-reader:edition-options', 'oops');
        assert(
            JSON.stringify(loadEditionOptions()) === JSON.stringify(DEFAULT_EDITION_OPTIONS),
            'edition options fall back to defaults on invalid JSON',
        );

        const pruned = pruneEditionOptions({
            ...DEFAULT_EDITION_OPTIONS,
            sectionCount: 0,
            weightGeneral: 5,
            weightNewness: -1,
        });
        assert(pruned.sectionCount >= 1, 'edition options prune clamps a tiny section count up');
        assert(pruned.weightGeneral <= 1, 'edition options prune clamps an oversized weight down');
        assert(pruned.weightNewness >= 0, 'edition options prune clamps a negative weight up');

        const edSection = (id: string, worthy: number, interest: number, newness = 0, popularity = 0) => ({
            id,
            title: id,
            articleIds: [id],
            scores: { worthy, interest, newness, popularity },
        });
        const edSections = [edSection('b', 1, 1), edSection('a', 9, 9)];
        const ranked = applyWeights(edSections, DEFAULT_EDITION_OPTIONS);
        assert(ranked[0].id === 'a' && ranked[1].id === 'b', 'applyWeights ranks higher scores first');
        assert(edSections[0].id === 'b', 'applyWeights does not mutate the input');
        const zeroed = applyWeights(edSections, {
            ...DEFAULT_EDITION_OPTIONS,
            weightGeneral: 0,
            weightPersonal: 0,
            weightNewness: 0,
            weightPopularity: 0,
        });
        assert(zeroed[0].id === 'a' && zeroed[1].id === 'b', 'applyWeights with zero weights falls back to id order');
        const tied = applyWeights([edSection('t-b', 5, 5), edSection('t-a', 5, 5)], DEFAULT_EDITION_OPTIONS);
        assert(tied[0].id === 't-a', 'applyWeights tiebreaks on section id');
        const freshFirst = applyWeights([edSection('old', 9, 9, 0, 0), edSection('new', 1, 1, 1, 1)], {
            ...DEFAULT_EDITION_OPTIONS,
            weightGeneral: 0,
            weightPersonal: 0,
            weightNewness: 0.5,
            weightPopularity: 0.5,
        });
        assert(freshFirst[0].id === 'new', 'applyWeights honors newness and popularity weights');
        assert(
            JSON.stringify(applyWeights(edSections, DEFAULT_EDITION_OPTIONS)) ===
                JSON.stringify(applyWeights(edSections, DEFAULT_EDITION_OPTIONS)),
            'applyWeights ranking is deterministic',
        );
    } finally {
        shims['localStorage'] = realLS;
    }
}

// ---- edition JSON shape guards ----
{
    const { normalizeEditionJson, normalizeEditionMeta } = await import('../src/services/api');

    const missing = normalizeEditionJson({ id: 'e1', generatedAt: 123, windowHours: 48, status: 'ready' });
    assert(
        Array.isArray(missing.sections) && missing.sections.length === 0,
        'edition guard defaults missing sections to []',
    );
    assert(missing.model === undefined && missing.opinion === undefined, 'edition guard omits absent optional fields');

    const badStatus = normalizeEditionJson({
        id: 'e1',
        generatedAt: 1,
        windowHours: 48,
        status: 'weird',
        sections: [],
    });
    assert(badStatus.status === 'failed', 'edition guard maps unknown status to failed');

    const full = normalizeEditionJson({
        id: 'e1',
        generatedAt: 1,
        windowHours: 48,
        status: 'ready',
        model: 'qwen3:8b',
        opinion: 'Our take.',
        sections: [
            {
                id: 's1',
                topic: 'Tech',
                title: 'Big Story',
                summary: 'A.\n\nB.',
                articleIds: ['a', 'b', 7],
                scores: { worthy: 1, interest: 2 },
                verified: true,
            },
            { id: 's2', title: 'Second' },
        ],
    });
    assert(full.sections.length === 2, 'edition guard keeps every section');
    assert(full.sections[0].articleIds.join(',') === 'a,b', 'edition guard drops non-string article ids');
    assert(
        full.sections[0].scores?.worthy === 1 && full.sections[0].verified === true,
        'edition guard keeps scores and verified',
    );
    assert(full.sections[1].articleIds.length === 0, 'edition guard defaults a missing article list to []');
    assert(full.opinion === 'Our take.' && full.model === 'qwen3:8b', 'edition guard keeps opinion and model');

    const meta = normalizeEditionMeta({ id: 'e1', generatedAt: 5, windowHours: 24, status: 'building' });
    assert(
        meta.id === 'e1' && meta.status === 'building' && meta.windowHours === 24,
        'edition meta guard keeps valid rows',
    );
    assert(normalizeEditionMeta({}).status === 'failed', 'edition meta guard maps unknown status to failed');

    const { editionKey, editionsKey } = await import('../src/query');
    assert(JSON.stringify(editionKey({ id: 'e1' })).includes('e1'), 'editionKey includes every param');
    assert(JSON.stringify(editionsKey({ limit: 10 })).includes('10'), 'editionsKey includes every param');
}
