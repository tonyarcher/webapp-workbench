import type { Play } from './types';

/** Every Play result carries all flags; this fills the defaults so callers override only what the play changed. */
export function playResult(
    partial: Partial<Play['result']> & Pick<Play['result'], 'deadAtYardline100'>,
): Play['result'] {
    return { yards: 0, firstDown: false, outOfBounds: false, incomplete: false, sack: false, ...partial };
}
