// Foreground feed-sync scheduling: pure gate before any timers or fetches.
import { assert } from './smoke-assert';

{
    const { autoSyncDue } = await import('../src/services/foreground-sync');
    const base = { hidden: false, focused: true, lastSyncAt: 0, now: 0, gapMs: 60_000 };
    assert(autoSyncDue({ ...base, now: 60_000 }), 'foreground sync runs when visible, focused, and past the gap');
    assert(!autoSyncDue({ ...base, hidden: true, now: 60_000 }), 'foreground sync skips a hidden tab');
    assert(!autoSyncDue({ ...base, focused: false, now: 60_000 }), 'foreground sync skips an unfocused tab');
    assert(!autoSyncDue({ ...base, now: 59_999 }), 'foreground sync waits for the gap after a recent run');
}
