import type {GenerateBody, GenerateResult, Playlist, PlaylistEntry} from '../types';

function apiUrl(path: string): string {
    const base = import.meta.env.BASE_URL;
    const root = base.endsWith('/') ? base : `${base}/`;
    return `${root}api${path}`;
}

async function readError(res: Response): Promise<string> {
    try {
        const body = (await res.json()) as {error?: string};
        return body.error ?? res.statusText;
    } catch {
        return res.statusText;
    }
}

async function json<T>(res: Response): Promise<T> {
    if (!res.ok) throw new Error(await readError(res));
    return res.json() as Promise<T>;
}

export function createPlaylist(body: GenerateBody): Promise<GenerateResult> {
    return fetch(apiUrl('/playlists'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    }).then((res) => json<GenerateResult>(res));
}

export function fetchPlaylist(id: string): Promise<Playlist> {
    return fetch(apiUrl(`/playlists/${id}`)).then((res) => json<Playlist>(res));
}

export function fetchEntries(id: string): Promise<PlaylistEntry[]> {
    return fetch(apiUrl(`/playlists/${id}/entries`)).then((res) => json<PlaylistEntry[]>(res));
}

export async function restorePlaylist(id: string): Promise<GenerateResult> {
    const [playlist, entries] = await Promise.all([fetchPlaylist(id), fetchEntries(id)]);
    return {playlist, entries};
}
