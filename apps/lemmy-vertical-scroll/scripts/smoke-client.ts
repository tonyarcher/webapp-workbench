// Client helper smoke: server registry, NSFW filter, formatting, router,
// URL safety, and post-sort lists.
import { fetchRegistryPopular, mergePopular, parseRegistryCsv, POPULAR_SERVERS } from '../src/services/registry';
import { clientFilterPosts } from '../src/query';
import { compactNumber, timeAgo } from '../src/services/format';
import { safeUrl } from '../src/services/url';
import { parseView, viewToPath } from '../src/router';
import { POST_SORTS, PIEFED_POST_SORTS, postSortsFor } from '../src/types';
import type { LemmyPost } from '../src/types';
import { assert, makePost } from './smoke-helpers';

// ---- popular server registry ----

export async function runRegistryTests(): Promise<void> {
    const csv = [
        'Instance,NU,NC,Fed,Adult,↓V,Users,BI,BB,UT,MO,Version',
        '[Lemmy.World](https://lemmy.world),Yes,Yes,Yes,Yes,Yes,18459,172,1,99%,12,0.19.3',
        '[Small](https://small.example),Yes,Yes,Yes,Yes,Yes,5,1,0,100%,3,0.19.3',
        '[NSFW Place](https://lemmynsfw.com),Yes,Yes,Yes,Yes,No,3577,177,26,99%,12,0.19.3',
        'malformed line without a markdown link',
        '[NoUsers](https://nousers.example),Yes,Yes,Yes,Yes,Yes,?,1,0,100%,3,0.19.3',
        '',
    ].join('\n');
    const parsed = parseRegistryCsv(csv);
    assert(parsed.length === 3, 'registry parse skips malformed and empty rows');
    assert(parsed[0]!.host === 'lemmy.world' && parsed[0]!.name === 'Lemmy.World', 'registry sorts by monthly users');
    assert(parsed[1]!.host === 'lemmynsfw.com' && parsed[1]!.nsfw === true, 'registry tags known NSFW hosts');
    assert(parsed[2]!.host === 'small.example', 'registry keeps smaller instances after the top');
    assert(!parsed.some((s) => s.host === 'nousers.example'), 'registry drops rows with invalid user counts');

    const failedRegistry = await fetchRegistryPopular((async () => {
        throw new TypeError('network down');
    }) as typeof fetch);
    assert(failedRegistry.length === 0, 'registry network failure yields an empty list');
    const nonOkRegistry = await fetchRegistryPopular(
        (async () => new Response('boom', { status: 500 })) as typeof fetch,
    );
    assert(nonOkRegistry.length === 0, 'registry non-ok response yields an empty list');

    const merged = mergePopular(POPULAR_SERVERS, [
        { host: 'lemmy.world', name: 'Lemmy.World', nsfw: false },
        { host: 'brand.new', name: 'Brand New', nsfw: false },
    ]);
    assert(merged[0]!.host === 'lemmy.world', 'registry entries rank before bundled duplicates');
    assert(merged.length === POPULAR_SERVERS.length + 1, 'merge dedupes overlapping hosts');
    assert(
        merged.some((s) => s.host === 'brand.new'),
        'merge keeps registry-only hosts',
    );
    assert(
        POPULAR_SERVERS.some((s) => s.host === 'lemmynsfw.com' && s.nsfw),
        'bundled list flags NSFW instances',
    );
    assert(
        POPULAR_SERVERS.some((s) => s.host === 'piefed.social'),
        'bundled list covers PieFed',
    );
}

// ---- NSFW client-side filter ----

export function runNsfwFilterTests(): void {
    const nsfwPost = makePost({ nsfw: true });
    const sfwPost = makePost({ nsfw: false });
    const mixed = [sfwPost, nsfwPost, sfwPost, nsfwPost, sfwPost];

    assert(clientFilterPosts(mixed, 'Include').length === 5, 'Include returns all');
    assert(clientFilterPosts(mixed, 'Exclude').length === 3, 'Exclude removes NSFW');
    assert(
        clientFilterPosts(mixed, 'Exclude').every((p: LemmyPost) => !p.nsfw),
        'Exclude only has SFW',
    );
    assert(clientFilterPosts(mixed, 'Only').length === 2, 'Only keeps NSFW');
    assert(
        clientFilterPosts(mixed, 'Only').every((p: LemmyPost) => p.nsfw),
        'Only has NSFW',
    );
    assert(clientFilterPosts([], 'Only').length === 0, 'filter handles empty');
}

// ---- format ----

export function runFormatTests(): void {
    const now = Date.parse('2026-01-02T00:00:00Z');
    assert(timeAgo('2026-01-01T00:00:00Z', now) === '1d', 'timeAgo days');
    assert(timeAgo('2026-01-01T23:00:00Z', now) === '1h', 'timeAgo hours');
    assert(timeAgo('2026-01-01T23:59:00Z', now) === '1m', 'timeAgo minutes');
    assert(timeAgo('2026-01-01T23:59:58Z', now) === 'just now', 'timeAgo seconds');
    assert(timeAgo('2027-01-01T00:00:00Z', now) === '', 'future timestamps render empty');
    assert(compactNumber(1234) === '1.2K', 'compact K');
    assert(compactNumber(3400000) === '3.4M', 'compact M');
    assert(compactNumber(42) === '42', 'compact plain');
}

// ---- router ----

export function runRouterTests(): void {
    assert(parseView('/').kind === 'feed', 'root parses to feed');
    assert(parseView('').kind === 'feed', 'empty path parses to feed');
    assert(parseView('/communities').kind === 'communities', 'communities view');
    const comm = parseView('/community/123');
    assert(comm.kind === 'community' && comm.communityId === 123, 'community view with id');
    assert(parseView('/community/abc').kind === 'communities', 'bad community id falls back');
    assert(parseView('/settings').kind === 'settings', 'settings view');
    assert(viewToPath(parseView('/community/5')) === '/community/5', 'view roundtrip');
    assert(viewToPath({ kind: 'feed' }) === '/', 'feed path');
}

// ---- url safety ----

export function runUrlSafetyTests(): void {
    assert(safeUrl('https://example.com/post/1') === 'https://example.com/post/1', 'https url passes');
    assert(safeUrl('http://example.com/x') === 'http://example.com/x', 'http url passes');
    assert(safeUrl('javascript:alert(1)') === null, 'javascript url rejected');
    assert(safeUrl('data:text/html,<script>') === null, 'data url rejected');
    assert(safeUrl('vbscript:msgbox(1)') === null, 'vbscript url rejected');
    assert(safeUrl('not a url') === null, 'unparseable url rejected');
    assert(safeUrl(null) === null, 'null url rejected');
}

// ---- sorts ----

export function runSortsTests(): void {
    for (const sort of ['Active', 'Hot', 'New', 'TopDay', 'TopAll', 'Controversial', 'Scaled']) {
        assert(POST_SORTS.includes(sort as never), `sort ${sort} covered`);
    }
    assert(PIEFED_POST_SORTS.length === 16, 'piefed post sorts are a curated subset');
    assert(
        postSortsFor('piefed').includes('TopAll') && !postSortsFor('piefed').includes('Controversial'),
        'piefed sort filtering',
    );
    assert(postSortsFor('lemmy').length === POST_SORTS.length, 'lemmy keeps full sort list');
}
