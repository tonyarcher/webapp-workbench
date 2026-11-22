// Dynamic body depth and storage purge: pure load states and confirm projection.
import { bodyLoadStatus, canRefetchBody } from '../src/services/body-load';
import { purgeAvailable, purgeResultLine, storageSizeLine } from '../src/services/storage-status';
import type { StorageStatus } from '../src/services/api';
import { assert } from './smoke-assert';

const withLink = { link: 'https://example.com/a' };

assert(canRefetchBody(withLink) === true, 'an article with a canonical link can be refetched');
assert(canRefetchBody({}) === false, 'a source without a canonical link cannot promise a refetch');
assert(canRefetchBody({ link: '   ' }) === false, 'a blank link is not a capability');

{
    const status = bodyLoadStatus({ summary: 'short', link: withLink.link }, false);
    assert(status.state === 'idle' && status.text === null, 'a summary-first article starts idle');
}
{
    const status = bodyLoadStatus({ summary: 'short', link: withLink.link }, true);
    assert(status.state === 'loading' && status.busy === true, 'a body fetch shows a busy status');
    assert(status.text === 'Loading full text…', 'the loading line names the work');
}
{
    const status = bodyLoadStatus({ content: '<p>body</p>' }, true);
    assert(status.state === 'loaded' && status.text === null, 'a loaded body wins over the loading flag');
}
{
    const status = bodyLoadStatus({ summary: 'short' }, false);
    assert(status.state === 'unavailable', 'a linkless source reports no full text');

    assert(status.text === 'Full text is unavailable for this source.', 'the unavailable line names the source limit');
}

const disabled: StorageStatus = {
    objectStoreEnabled: false,
    offloadEnabled: false,
    requirePressure: false,
    databaseBytes: 0,
    dbTriggerBytes: 2_000_000_000,
    backupMinutes: 0,
    backupTriggerMinutes: 15,
    pressureTriggered: false,
    purgeEnabled: false,
    purgeAfterDays: 365,
};
assert(purgeAvailable(null) === false, 'no storage status hides the purge action');
assert(purgeAvailable(disabled) === false, 'a server with purge off hides the purge action');
assert(purgeAvailable({ ...disabled, purgeEnabled: true }) === true, 'purge on shows the confirmable action');
assert(purgeResultLine(1).includes('1 old body object'), 'purge result names the singular count');
assert(purgeResultLine(3).includes('3 old body objects'), 'purge result names the plural count');
assert(purgeResultLine(3).includes('Articles were not deleted'), 'purge result states article rows survive');
assert(storageSizeLine(2_000_000_000) === '2.00 GB', 'storage size is a readable GB figure');
