import type { EmbedCommand } from './embeds/types';

/**
 * Commands that bring a scriptable embed in line with the slide it belongs to.
 * While the session is silent, mute before play so the browser autoplay policy
 * allows the player to start. Once the user has turned sound on, skip mute —
 * mute+unMute in the same turn can leave some players at a ducked volume.
 */
export function syncCommands(active: boolean, soundOn: boolean): EmbedCommand[] {
    if (!active) return ['pause'];
    return soundOn ? ['play', 'unmute'] : ['mute', 'play'];
}

/**
 * A freshly created player starts muted under the autoplay policy no matter
 * what its URL asks for. The unmute sent at load/ready lands before that
 * fallback, so a flip to another slide (which recreates the iframe) comes back
 * silent. Re-assert the session choice once the player reports it is actually
 * playing.
 */
export function playedCommands(soundOn: boolean): EmbedCommand[] {
    return soundOn ? ['unmute'] : [];
}
