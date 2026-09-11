import {parseSettings, serializeSettings, defaultSettings} from '../src/services/settings';
import {traktProxyUrl} from '../src/services/url';
import {refreshAccessToken, tokenExpiry} from '../src/services/trakt-auth';

function assert(cond: unknown, msg: string): void {
    if (!cond) throw new Error(`FAIL: ${msg}`);
}

{
    const settings = defaultSettings();
    assert(settings.version === 1, 'default version');
    assert(settings.trakt.includeCalendar === true, 'default calendar on');
    assert(settings.google.writtenUids.length === 0, 'default no uids');
    const round = parseSettings(serializeSettings(settings));
    assert(round !== null, 'round trip');
    assert(round?.trakt.includeHistory === true, 'round trip history');
}

{
    const withToken = defaultSettings();
    withToken.trakt.accessToken = 'tok';
    withToken.trakt.refreshToken = 'ref';
    withToken.trakt.accessExpiresAt = 1_700_000_000_000;
    withToken.google.writtenUids = ['a', 'b'];
    withToken.lastSync = {at: 1, count: 3, failed: 1, destination: 'google'};
    const round = parseSettings(serializeSettings(withToken));
    assert(round?.trakt.accessToken === 'tok', 'keeps access token');
    assert(round?.google.writtenUids.join(',') === 'a,b', 'keeps uids');
    assert(round?.lastSync?.destination === 'google', 'keeps last sync');
}

assert(parseSettings(null) === null, 'empty settings');
assert(parseSettings('{') === null, 'corrupt json');
assert(parseSettings('{"version":2}') === null, 'wrong version');
assert(parseSettings('[]') === null, 'array rejected');

{
    const partial = parseSettings('{"version":1,"trakt":{"clientId":"x"}}');
    assert(partial?.trakt.clientId === 'x', 'partial client id');
    assert(partial?.trakt.clientSecret === '', 'missing secret default');
    assert(partial?.google.clientId === '', 'missing google default');
}

assert(traktProxyUrl('./') === './api/trakt', 'proxy url relative');
assert(traktProxyUrl('/calendar-sync/') === '/calendar-sync/api/trakt', 'proxy url subpath');
assert(tokenExpiry({accessToken: 'a', refreshToken: 'b', expiresIn: 60}, 1_000) === 61_000, 'token expiry ms');
{
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
        const body = String(init?.body ?? '');
        assert(body.includes('refresh_token'), 'refresh posts refresh_token');
        assert(!body.includes('password'), 'refresh body has no password');
        return new Response(JSON.stringify({access_token: 'n', refresh_token: 'r', expires_in: 3600}), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
        });
    }) as typeof fetch;
    const token = await refreshAccessToken(fetchImpl, 'https://proxy.example/', 'id', 'secret', 'ref');
    assert(token.accessToken === 'n', 'refresh access');
}

console.log('smoke.ts: all assertions passed');

export {};
