import {parseSettings, serializeSettings, defaultSettings} from '../src/services/settings';
import {traktProxyUrl} from '../src/services/url';

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

console.log('smoke.ts: all assertions passed');

export {};
