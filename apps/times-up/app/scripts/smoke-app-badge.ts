// S4 smoke: the unread total and badge formatting are pure, so they can be
// pinned without a browser or a badge API.
import { assert } from './smoke-assert';
import { APP_BADGE_CAP, badgeLabel, badgeValue, totalUnreadFromLibrary } from '../src/services/app-badge';

assert(totalUnreadFromLibrary(null) === 0, 'a missing library contributes zero');
assert(totalUnreadFromLibrary({}) === 0, 'a library without feeds contributes zero');
assert(totalUnreadFromLibrary({ feeds: [] }) === 0, 'an empty feed list contributes zero');

const data = { feeds: [{ unread: 3 }, { unread: 0 }, { unread: 7 }] };
assert(totalUnreadFromLibrary(data) === 10, 'the total is the sum of feed unread counts');
assert(totalUnreadFromLibrary({ feeds: [{ unread: 5 }, {}] }) === 5, 'a missing unread defaults to zero');

assert(badgeValue(0) === 0, 'zero maps to zero');
assert(badgeValue(10) === 10, 'small counts pass through');
assert(badgeValue(APP_BADGE_CAP) === APP_BADGE_CAP, 'the cap is inclusive');
assert(badgeValue(APP_BADGE_CAP + 1) === APP_BADGE_CAP, 'counts above the cap clamp to the cap');

assert(badgeLabel(0) === '', 'zero has no label');
assert(badgeLabel(5) === '5', 'small counts render as digits');
assert(badgeLabel(99) === '99', '99 renders without a plus');
assert(badgeLabel(100) === '99+', '100 renders as 99+');
