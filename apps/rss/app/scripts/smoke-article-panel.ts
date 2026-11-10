// Article panel splitter smoke: the keyboard path is the only way to set the
// width without a pointer, so the stepping and clamping are pinned here. The
// component itself needs a DOM to instantiate, so the arithmetic lives in
// article-panel-settings and is tested through it. Mirrors smoke-sidebar.
import {
    ARTICLE_PANEL_KEY_STEP,
    ARTICLE_PANEL_KEY_STEP_LARGE,
    MAX_ARTICLE_PANEL_WIDTH,
    MIN_ARTICLE_PANEL_WIDTH,
    clampArticlePanelWidth,
    nextArticlePanelWidth,
} from '../src/web-components/app-shell/article-panel-settings';
import { assert } from './smoke-assert';

const mid = Math.round((MIN_ARTICLE_PANEL_WIDTH + MAX_ARTICLE_PANEL_WIDTH) / 2);

// ---- arrows step, Shift steps coarse; the panel docks right so left grows ----
assert(nextArticlePanelWidth(mid, 'ArrowLeft', false) === mid + ARTICLE_PANEL_KEY_STEP, 'ArrowLeft grows the panel');
assert(
    nextArticlePanelWidth(mid, 'ArrowRight', false) === mid - ARTICLE_PANEL_KEY_STEP,
    'ArrowRight shrinks the panel',
);
assert(
    nextArticlePanelWidth(mid, 'ArrowLeft', true) === mid + ARTICLE_PANEL_KEY_STEP_LARGE,
    'Shift ArrowLeft grows coarse',
);
assert(
    nextArticlePanelWidth(mid, 'ArrowRight', true) === mid - ARTICLE_PANEL_KEY_STEP_LARGE,
    'Shift ArrowRight shrinks coarse',
);
assert(ARTICLE_PANEL_KEY_STEP_LARGE > ARTICLE_PANEL_KEY_STEP, 'the coarse step is larger');

// ---- Home and End jump to the bounds ----
assert(nextArticlePanelWidth(mid, 'Home', false) === MAX_ARTICLE_PANEL_WIDTH, 'Home goes to max');
assert(nextArticlePanelWidth(mid, 'End', false) === MIN_ARTICLE_PANEL_WIDTH, 'End goes to min');
assert(nextArticlePanelWidth(mid, 'Home', true) === MAX_ARTICLE_PANEL_WIDTH, 'Home ignores Shift');

// ---- clamping holds at both ends, so a key repeat cannot drift past ----
assert(
    nextArticlePanelWidth(MAX_ARTICLE_PANEL_WIDTH, 'ArrowLeft', false) === MAX_ARTICLE_PANEL_WIDTH,
    'ArrowLeft clamps at max',
);
assert(
    nextArticlePanelWidth(MIN_ARTICLE_PANEL_WIDTH, 'ArrowRight', false) === MIN_ARTICLE_PANEL_WIDTH,
    'ArrowRight clamps at min',
);
assert(
    nextArticlePanelWidth(MIN_ARTICLE_PANEL_WIDTH, 'ArrowRight', true) === MIN_ARTICLE_PANEL_WIDTH,
    'coarse ArrowRight clamps at min',
);

// ---- a key that is not ours must be left alone, so it is not preventDefaulted ----
for (const key of ['Enter', ' ', 'Escape', 'a', 'PageDown', 'Tab', 'ArrowUp', 'ArrowDown']) {
    assert(nextArticlePanelWidth(mid, key, false) === null, `ignores ${key}`);
    assert(nextArticlePanelWidth(mid, key, true) === null, `ignores ${key} with Shift`);
}

// ---- the drag path shares the same clamp, so the two cannot disagree ----
assert(clampArticlePanelWidth(0) === MIN_ARTICLE_PANEL_WIDTH, 'clamp below min');
assert(clampArticlePanelWidth(99999) === MAX_ARTICLE_PANEL_WIDTH, 'clamp above max');
assert(clampArticlePanelWidth(mid) === mid, 'clamp passes a mid value through');
assert(clampArticlePanelWidth(mid + 0.4) === mid, 'clamp rounds to a whole pixel');
assert(
    nextArticlePanelWidth(mid, 'ArrowLeft', false) === clampArticlePanelWidth(mid + ARTICLE_PANEL_KEY_STEP),
    'the key path and the drag clamp agree',
);
