// Coalescer smoke: concurrent same-key runs share one job; failures clear the slot.
import { createCoalescer } from '../src/services/coalesce';
import { assert } from './smoke-assert';

// ---- elevator-button coalescing ----
{
    const c = createCoalescer<string, number>();
    let calls = 0;
    const fn = async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 10));
        return 42;
    };
    const [a, b] = await Promise.all([c.run('k', fn), c.run('k', fn)]);
    assert(calls === 1, 'concurrent run for the same key invokes fn once');
    assert(a === 42 && b === 42, 'concurrent callers resolve to the same value');

    let calls2 = 0;
    const fn2 = async () => {
        calls2++;
        return 7;
    };
    assert((await c.run('k', fn2)) === 7, 'a later run after settle invokes a new fn');
    assert(calls2 === 1, 'post-settle run starts a fresh job');

    let callsA = 0;
    let callsB = 0;
    const other = createCoalescer<string, number>();
    const [ra, rb] = await Promise.all([
        other.run('a', async () => {
            callsA++;
            await new Promise((r) => setTimeout(r, 5));
            return 1;
        }),
        other.run('b', async () => {
            callsB++;
            await new Promise((r) => setTimeout(r, 5));
            return 2;
        }),
    ]);
    assert(callsA === 1 && callsB === 1, 'different keys run independently');
    assert(ra === 1 && rb === 2, 'different keys resolve to their own values');

    const failing = createCoalescer<string, number>();
    const bad = async () => {
        throw new Error('coalesced job failed');
    };
    let badThrew = false;
    try {
        await failing.run('k', bad);
    } catch {
        badThrew = true;
    }
    assert(badThrew, 'a rejected job propagates the error');
    let retried = 0;
    assert(
        (await failing.run('k', async () => {
            retried++;
            return 9;
        })) === 9,
        'a rejected job is cleared so the next run starts fresh',
    );
    assert(retried === 1, 'post-failure run invokes a new fn exactly once');
}
