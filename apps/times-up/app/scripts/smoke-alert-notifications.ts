// S3 smoke: alert hit counting, the notification gate, the payload shape, and
// the check flow with an injected fetcher and shower.
import { assert } from './smoke-assert';
import { memoryStorage } from './smoke-storage';
import {
    ALERT_NOTIFICATION_TAG,
    ALERTS_ROUTE,
    alertHitCounts,
    alertNotificationGate,
    buildAlertNotification,
    clearAlertSnapshot,
    loadAlertSnapshot,
    newAlertHits,
    parseAlertSnapshot,
    runAlertCheck,
    saveAlertSnapshot,
    type AlertNotificationPayload,
} from '../src/services/alert-notifications';
import type { QuietHours } from '../src/services/quiet-hours';

assert(
    alertNotificationGate({ permission: 'unsupported', hidden: true, quiet: false }) === 'unsupported',
    'no API is unsupported',
);
assert(
    alertNotificationGate({ permission: 'denied', hidden: true, quiet: false }) === 'blocked',
    'a denial blocks delivery',
);
assert(
    alertNotificationGate({ permission: 'default', hidden: true, quiet: false }) === 'blocked',
    'an unanswered prompt blocks delivery',
);
assert(
    alertNotificationGate({ permission: 'granted', hidden: true, quiet: true }) === 'quiet',
    'quiet hours defer delivery',
);
assert(
    alertNotificationGate({ permission: 'granted', hidden: false, quiet: false }) === 'focused',
    'a focused tab records a baseline',
);
assert(
    alertNotificationGate({ permission: 'granted', hidden: true, quiet: false }) === 'show',
    'a hidden granted tab may notify',
);

const counts = alertHitCounts([
    { id: 'a', hits: [1, 2] },
    { id: 'b', hits: [] },
]);
assert(counts['a'] === 2 && counts['b'] === 0, 'hit counts are per alert id');

assert(newAlertHits({}, { a: 2 }) === 2, 'a first sighting counts every hit');
assert(newAlertHits({ a: 2 }, { a: 2 }) === 0, 'an unchanged alert adds nothing');
assert(newAlertHits({ a: 2 }, { a: 5 }) === 3, 'only the increase counts');
assert(newAlertHits({ a: 5 }, { a: 1 }) === 0, 'a drop never offsets another alert');
assert(newAlertHits({ a: 1, b: 4 }, { a: 2, b: 0 }) === 1, 'a drop and a rise in the same check count only the rise');
assert(newAlertHits({ gone: 9 }, {}) === 0, 'a removed alert adds nothing');

const one = buildAlertNotification(1);
assert(one.title === 'Times Up alerts', 'the title names the app and the channel');
assert(one.body === '1 new story matches your alerts.', 'one hit reads singular');
assert(one.tag === ALERT_NOTIFICATION_TAG, 'every alert shares one tag so hits collapse');
assert(one.data.route === ALERTS_ROUTE, 'the deep link is the app alerts route');
const many = buildAlertNotification(3);
assert(many.body === '3 new stories match your alerts.', 'many hits read plural');
const payload = JSON.stringify(many).toLowerCase();
for (const forbidden of ['http', 'article', 'token', 'user', '@']) {
    assert(!payload.includes(forbidden), `the alert payload carries no ${forbidden} data`);
}

assert(JSON.stringify(parseAlertSnapshot(null)) === '{}', 'no snapshot parses as empty');
assert(JSON.stringify(parseAlertSnapshot('{')) === '{}', 'malformed snapshot parses as empty');
assert(JSON.stringify(parseAlertSnapshot('null')) === '{}', 'a null snapshot parses as empty');
assert(parseAlertSnapshot('{"a":3}')['a'] === 3, 'a stored count parses');
assert(parseAlertSnapshot('{"a":0}')['a'] === undefined, 'zero counts are dropped');
assert(parseAlertSnapshot('{"a":-2}')['a'] === undefined, 'negative counts are dropped');
assert(parseAlertSnapshot('{"a":1.5}')['a'] === undefined, 'fractional counts are dropped');

const store = memoryStorage();
saveAlertSnapshot({ a: 4 }, store);
assert(loadAlertSnapshot(store)['a'] === 4, 'the snapshot round-trips through storage');
clearAlertSnapshot(store);
assert(loadAlertSnapshot(store)['a'] === undefined, 'clearing drops the snapshot');

const quietOff: QuietHours = { enabled: false, startMinute: 22 * 60, endMinute: 7 * 60 };
const quietOn: QuietHours = { enabled: true, startMinute: 22 * 60, endMinute: 7 * 60 };
const groups = [
    { id: 'a', hits: [1, 2] },
    { id: 'b', hits: [] },
];
const noon = new Date(2026, 0, 1, 12, 0);
const late = new Date(2026, 0, 1, 23, 30);

let shown: AlertNotificationPayload[] = [];
/** Read through a call: an `assert` on the property would narrow its type. */
const shownCount = (): number => shown.length;
const deps = {
    fetchGroups: async () => groups,
    show: async (payload: AlertNotificationPayload) => {
        shown.push(payload);
        return true;
    },
    storage: store,
    now: noon,
    permission: 'granted' as const,
    quietHours: quietOff,
};

// Focused: record the baseline without notifying.
shown = [];
clearAlertSnapshot(store);
assert((await runAlertCheck({ ...deps, hidden: false })) === 'focused', 'a focused tab does not notify');
assert(shownCount() === 0, 'nothing was shown while focused');
assert(loadAlertSnapshot(store)['a'] === 2, 'a focused check records the baseline');

// Hidden with new hits: notify once, then stay quiet.
shown = [];
assert((await runAlertCheck({ ...deps, hidden: true })) === 'no-new-hits', 'a baseline makes the same hits old');
assert(shownCount() === 0, 'no repeat for unchanged hits');

clearAlertSnapshot(store);
assert((await runAlertCheck({ ...deps, hidden: true })) === 'shown', 'new hits in a hidden tab notify');
assert(shownCount() === 1, 'one collapsed notification is shown');
assert(shown[0]!.body === '2 new stories match your alerts.', 'the notification carries the hit count');
assert((await runAlertCheck({ ...deps, hidden: true })) === 'no-new-hits', 'the shown hits are not repeated');

// Quiet hours defer without advancing the baseline.
clearAlertSnapshot(store);
shown = [];
assert(
    (await runAlertCheck({ ...deps, hidden: true, now: late, quietHours: quietOn })) === 'quiet',
    'quiet hours defer',
);
assert(shownCount() === 0, 'nothing is shown during quiet hours');
assert(loadAlertSnapshot(store)['a'] === undefined, 'quiet hours keep the hits pending');

// Permission gates skip the network.
let fetches = 0;
const counting = {
    ...deps,
    fetchGroups: async () => {
        fetches += 1;
        return groups;
    },
};
assert(
    (await runAlertCheck({ ...counting, hidden: true, permission: 'denied' })) === 'blocked',
    'a denial blocks the check',
);
assert(
    (await runAlertCheck({ ...counting, hidden: true, permission: 'default' })) === 'blocked',
    'an unanswered prompt blocks the check',
);
assert(
    (await runAlertCheck({ ...counting, hidden: true, permission: 'unsupported' })) === 'unsupported',
    'a missing API is unsupported',
);
assert(fetches === 0, 'a blocked check never fetches alerts');

assert(
    (await runAlertCheck({
        ...deps,
        hidden: true,
        fetchGroups: async () => {
            throw new Error('offline');
        },
    })) === 'failed',
    'a failed fetch is reported, not thrown',
);

console.log('ok: alert notification gate, payload, and check flow');
