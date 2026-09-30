// Sidebar splitter smoke: the keyboard path is the only way to set the width
// without a pointer, so the stepping and clamping are pinned here. The component
// itself needs a DOM to instantiate, so the arithmetic lives in
// source-list-settings and is tested through it.
import {
    MAX_SIDEBAR_WIDTH,
    MIN_SIDEBAR_WIDTH,
    SIDEBAR_KEY_STEP,
    SIDEBAR_KEY_STEP_LARGE,
    clampSidebarWidth,
    nextSidebarWidth,
} from '../src/web-components/source-list/source-list-settings';
import { assert } from './smoke-assert';

const mid = Math.round((MIN_SIDEBAR_WIDTH + MAX_SIDEBAR_WIDTH) / 2);

// ---- arrows step, Shift steps coarse ----
assert(nextSidebarWidth(mid, 'ArrowRight', false) === mid + SIDEBAR_KEY_STEP, 'ArrowRight steps');
assert(nextSidebarWidth(mid, 'ArrowLeft', false) === mid - SIDEBAR_KEY_STEP, 'ArrowLeft steps');
assert(nextSidebarWidth(mid, 'ArrowRight', true) === mid + SIDEBAR_KEY_STEP_LARGE, 'Shift ArrowRight steps coarse');
assert(nextSidebarWidth(mid, 'ArrowLeft', true) === mid - SIDEBAR_KEY_STEP_LARGE, 'Shift ArrowLeft steps coarse');
assert(SIDEBAR_KEY_STEP_LARGE > SIDEBAR_KEY_STEP, 'the coarse step is larger');

// ---- Home and End jump to the bounds ----
assert(nextSidebarWidth(mid, 'Home', false) === MIN_SIDEBAR_WIDTH, 'Home goes to min');
assert(nextSidebarWidth(mid, 'End', false) === MAX_SIDEBAR_WIDTH, 'End goes to max');
assert(nextSidebarWidth(MAX_SIDEBAR_WIDTH, 'Home', true) === MIN_SIDEBAR_WIDTH, 'Home ignores Shift');

// ---- clamping holds at both ends, so a key repeat cannot drift past ----
assert(nextSidebarWidth(MAX_SIDEBAR_WIDTH, 'ArrowRight', false) === MAX_SIDEBAR_WIDTH, 'ArrowRight clamps at max');
assert(
    nextSidebarWidth(MAX_SIDEBAR_WIDTH, 'ArrowRight', true) === MAX_SIDEBAR_WIDTH,
    'coarse ArrowRight clamps at max',
);
assert(nextSidebarWidth(MIN_SIDEBAR_WIDTH, 'ArrowLeft', false) === MIN_SIDEBAR_WIDTH, 'ArrowLeft clamps at min');
assert(nextSidebarWidth(MIN_SIDEBAR_WIDTH, 'ArrowLeft', true) === MIN_SIDEBAR_WIDTH, 'coarse ArrowLeft clamps at min');

// ---- a key that is not ours must be left alone, so it is not preventDefaulted ----
for (const key of ['Enter', ' ', 'Escape', 'a', 'PageDown', 'Tab', 'ArrowUp', 'ArrowDown']) {
    assert(nextSidebarWidth(mid, key, false) === null, `ignores ${key}`);
    assert(nextSidebarWidth(mid, key, true) === null, `ignores ${key} with Shift`);
}

// ---- the drag path shares the same clamp, so the two cannot disagree ----
assert(clampSidebarWidth(0) === MIN_SIDEBAR_WIDTH, 'clamp below min');
assert(clampSidebarWidth(99999) === MAX_SIDEBAR_WIDTH, 'clamp above max');
assert(clampSidebarWidth(mid) === mid, 'clamp passes a mid value through');
assert(clampSidebarWidth(mid + 0.4) === mid, 'clamp rounds to a whole pixel');
assert(
    nextSidebarWidth(mid, 'ArrowRight', false) === clampSidebarWidth(mid + SIDEBAR_KEY_STEP),
    'the key path and the drag clamp agree',
);
