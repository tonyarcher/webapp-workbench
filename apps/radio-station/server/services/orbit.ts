import type {Track} from '../types.js';
import type {OrbitPolicy, SeparationWindows} from './clock.js';

export function shouldForceNumberOne(
    track: Track | undefined,
    now: number,
    weekStart: number,
    lastByTrack: Map<string, number>,
    lastByArtist: Map<string, number>,
    windows: SeparationWindows,
    orbit: OrbitPolicy,
    goldLeak: number,
): boolean {
    if (!track || goldLeak >= 100) return false;
    const last = lastByTrack.get(track.id);
    const since = last == null ? now - weekStart : now - last;
    if (since < orbit.forceMs) return false;
    if (last != null && now - last < orbit.minMs) return false;
    const artistLast = lastByArtist.get(track.artist);
    if (artistLast != null && now - artistLast < windows.artistMs * 0.5) return false;
    return true;
}
