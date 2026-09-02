import type {SavedSession} from '../types';

const KEY = 'radio-station.session.v1';

export function loadSession(): SavedSession | null {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as SavedSession;
        if (parsed.version !== 1 || !parsed.playlistId) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function saveSession(session: SavedSession): void {
    localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
    localStorage.removeItem(KEY);
}
