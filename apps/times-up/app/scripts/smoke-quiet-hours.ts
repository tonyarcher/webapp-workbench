// S3 smoke: the shared quiet-hours window. Local time, half-open, and an empty
// window when start and end match so a mistake cannot mute every alert.
import { assert } from './smoke-assert';
import { memoryStorage } from './smoke-storage';
import {
    DEFAULT_QUIET_HOURS,
    formatMinute,
    isQuietAt,
    loadQuietHours,
    minutesOfDay,
    parseQuietHours,
    parseTimeValue,
    saveQuietHours,
} from '../src/services/quiet-hours';

assert(DEFAULT_QUIET_HOURS.enabled === false, 'quiet hours start off');
assert(DEFAULT_QUIET_HOURS.startMinute === 22 * 60, 'the default window starts at 22:00');
assert(DEFAULT_QUIET_HOURS.endMinute === 7 * 60, 'the default window ends at 07:00');

const overnight = { enabled: true, startMinute: 22 * 60, endMinute: 7 * 60 };
assert(isQuietAt(23 * 60, overnight), '23:00 is inside an overnight window');
assert(isQuietAt(0, overnight), 'midnight is inside an overnight window');
assert(isQuietAt(6 * 60 + 59, overnight), '06:59 is still inside an overnight window');
assert(!isQuietAt(7 * 60, overnight), 'the end minute is outside the window');
assert(!isQuietAt(12 * 60, overnight), 'noon is outside an overnight window');
assert(!isQuietAt(21 * 60 + 59, overnight), 'the minute before the start is outside');
assert(isQuietAt(22 * 60, overnight), 'the start minute is inside the window');

const daytime = { enabled: true, startMinute: 9 * 60, endMinute: 17 * 60 };
assert(isQuietAt(9 * 60, daytime), 'the start minute is inside a same-day window');
assert(isQuietAt(16 * 60 + 59, daytime), '16:59 is inside a same-day window');
assert(!isQuietAt(17 * 60, daytime), 'the end minute is outside a same-day window');
assert(!isQuietAt(8 * 60 + 59, daytime), 'before a same-day window is not quiet');

assert(!isQuietAt(12 * 60, { ...daytime, enabled: false }), 'a disabled window is never quiet');
assert(!isQuietAt(12 * 60, { enabled: true, startMinute: 600, endMinute: 600 }), 'an empty window is never quiet');

assert(minutesOfDay(new Date(2026, 0, 1, 7, 5)) === 7 * 60 + 5, 'minutesOfDay reads local hours and minutes');

assert(formatMinute(0) === '00:00', 'midnight formats as 00:00');
assert(formatMinute(90) === '01:30', 'minutes format with a leading zero');
assert(formatMinute(23 * 60 + 59) === '23:59', 'the last minute formats');

assert(parseTimeValue('07:00') === 7 * 60, 'a time input parses to minutes');
assert(parseTimeValue('7:05') === 7 * 60 + 5, 'a single-digit hour parses');
assert(parseTimeValue('24:00') === null, 'hour 24 is rejected');
assert(parseTimeValue('07:60') === null, 'minute 60 is rejected');
assert(parseTimeValue('') === null, 'an empty value is rejected');
assert(parseTimeValue('nope') === null, 'garbage is rejected');

assert(parseQuietHours(null).enabled === false, 'no stored value yields the default');
assert(parseQuietHours('{').enabled === false, 'malformed JSON yields the default');
assert(parseQuietHours('null').enabled === false, 'a null document yields the default');
const parsed = parseQuietHours('{"enabled":true,"startMinute":540,"endMinute":1020}');
assert(parsed.enabled && parsed.startMinute === 540 && parsed.endMinute === 1020, 'a stored window parses');
assert(
    parseQuietHours('{"enabled":true,"startMinute":-1,"endMinute":2000}').startMinute === 22 * 60,
    'an out-of-range start falls back',
);
assert(parseQuietHours('{"enabled":"yes"}').enabled === false, 'only a true boolean enables the window');

const store = memoryStorage();
assert(loadQuietHours(store).enabled === false, 'an empty store yields the default');
saveQuietHours({ enabled: true, startMinute: 60, endMinute: 120 }, store);
const loaded = loadQuietHours(store);
assert(
    loaded.enabled && loaded.startMinute === 60 && loaded.endMinute === 120,
    'the window round-trips through storage',
);
saveQuietHours({ enabled: true, startMinute: 9999, endMinute: -5 }, store);
assert(loadQuietHours(store).startMinute === 22 * 60, 'saving clamps an invalid start');
assert(loadQuietHours(store).endMinute === 7 * 60, 'saving clamps an invalid end');

console.log('ok: quiet hours window, parsing, and storage');
