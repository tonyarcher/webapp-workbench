import {generatePlaylist, getEntries, getPlaylist} from '../playlists.js';
import {formatPlaylistTxt} from '../services/export-txt.js';
import {HttpError, isUuid, readJsonBody, sendText, type RouteHandler} from '../http.js';

function requireId(id: string | undefined): string {
    if (!isUuid(id)) throw new HttpError(400, 'invalid playlist id');
    return id;
}

function parseTimeZone(raw: string | null): string {
    const timeZone = raw || 'UTC';
    try {
        new Intl.DateTimeFormat('en', {timeZone}).format(0);
        return timeZone;
    } catch {
        throw new HttpError(400, 'invalid time zone');
    }
}

export const createPlaylistHandler: RouteHandler = async (ctx) => {
    const body = (await readJsonBody(ctx.req)) ?? {};
    if (body !== null && typeof body !== 'object') throw new HttpError(400, 'expected JSON object');
    return generatePlaylist(body as {stationId?: string; seed?: string; startsAt?: number; weights?: unknown});
};

export const getPlaylistHandler: RouteHandler = async (ctx) => {
    const playlist = await getPlaylist(requireId(ctx.params.id));
    if (!playlist) throw new HttpError(404, 'playlist not found');
    return playlist;
};

export const getEntriesHandler: RouteHandler = async (ctx) => {
    const id = requireId(ctx.params.id);
    const playlist = await getPlaylist(id);
    if (!playlist) throw new HttpError(404, 'playlist not found');
    return getEntries(id);
};

export const getPlaylistTxtHandler: RouteHandler = async (ctx) => {
    const id = requireId(ctx.params.id);
    const playlist = await getPlaylist(id);
    if (!playlist) throw new HttpError(404, 'playlist not found');
    const entries = await getEntries(id);
    const txt = formatPlaylistTxt({
        stationName: playlist.stationName,
        seed: playlist.seed,
        weights: playlist.weights,
        entries,
        timeZone: parseTimeZone(ctx.query.get('tz')),
    });
    sendText(ctx.res, 200, txt, `${playlist.seed}.txt`);
};
