// Shared smoke helpers: assertions, fetch mocks with request capture, fixtures.
import type { LemmyPost } from '../src/types';

export function assert(cond: unknown, msg: string): void {
    if (!cond) throw new Error(`FAIL: ${msg}`);
}

export function mockFetchImpl(body: unknown, status = 200, throws = false): typeof fetch {
    const impl = async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
        if (throws) throw new TypeError('network down');
        return new Response(status >= 400 ? JSON.stringify({ error: 'invalid_sort' }) : JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
        });
    };
    return impl as unknown as typeof fetch;
}

let lastRequest: { url: string } | null = null;
export function capturingFetchImpl(body: unknown, status = 200): typeof fetch {
    return (async (input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
        lastRequest = { url: String(input) };
        return mockFetchImpl(body, status)(input);
    }) as unknown as typeof fetch;
}

export function request(): URL {
    if (!lastRequest) throw new Error('FAIL: no request captured');
    return new URL(lastRequest.url);
}

export function query(): URLSearchParams {
    return request().searchParams;
}

/** Returns one response per request, in order, then repeats the last. */
export function fetchSequence(bodies: unknown[], status = 200): typeof fetch {
    let index = 0;
    return (async (input: string | URL | Request): Promise<Response> => {
        lastRequest = { url: String(input) };
        const body = bodies[Math.min(index, bodies.length - 1)];
        index++;
        return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
}

export let lastRequestDetails: { url: string; method: string; headers: Headers; body: string } | null = null;
/** Records method/headers/body so auth behavior can be asserted; also feeds `request()`/`query()`. */
export function capturingAuthFetchImpl(body: unknown, status = 200): typeof fetch {
    return (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        lastRequest = { url: String(input) };
        lastRequestDetails = {
            url: String(input),
            method: init?.method ?? 'GET',
            headers: new Headers(init?.headers),
            body: init?.body ? String(init.body) : '',
        };
        return mockFetchImpl(body, status)(input, init);
    }) as unknown as typeof fetch;
}

export function lastBody(): Record<string, unknown> {
    if (!lastRequestDetails) throw new Error('FAIL: no request captured');
    return JSON.parse(lastRequestDetails.body) as Record<string, unknown>;
}

export function lastHeaders(): Headers {
    if (!lastRequestDetails) throw new Error('FAIL: no request captured');
    return lastRequestDetails.headers;
}

/** Raw Lemmy post/list row shared by the post, community and site tests. */
export const rawPost = {
    post: {
        id: 1,
        name: 'Hello world',
        url: 'https://example.com/hello',
        body: null,
        thumbnail_url: 'https://example.com/t.png',
        nsfw: false,
        pinned_local: false,
        pinned_community: false,
        published: '2026-01-01T00:00:00Z',
        community_id: 7,
        ap_id: 'https://lemmy.ca/post/12345',
        post_url_content_type: 'Link',
    },
    community: {
        id: 7,
        name: 'main',
        title: 'Main',
        actor_id: 'https://lemmy.ml/c/main',
        local: true,
        icon: null,
        banner: null,
        description: null,
        published: '2026-01-01T00:00:00Z',
    },
    creator: { actor_id: 'https://lemmy.ml/u/bob', name: 'bob', display_name: 'Bob', avatar: null },
    counts: { score: 42, upvotes: 50, downvotes: 8, comments: 3 },
    my_vote: null,
};

export function makePost(overrides: Partial<LemmyPost>): LemmyPost {
    return {
        id: 1,
        name: 'p',
        url: null,
        body: null,
        thumbnailUrl: null,
        nsfw: false,
        pinnedLocal: false,
        pinnedCommunity: false,
        published: '2026-01-01T00:00:00Z',
        communityId: 1,
        communityName: 'c',
        communityActorId: 'https://x/c',
        communityTitle: 'C',
        communityIcon: null,
        creatorActorId: 'https://x/u',
        creatorName: 'u',
        creatorDisplayName: null,
        creatorAvatar: null,
        score: 0,
        upvotes: 0,
        downvotes: 0,
        comments: 0,
        myVote: null,
        postUrl: 'https://x/post/1',
        postType: null,
        imageUrls: [],
        videoUrl: null,
        linkUrl: null,
        ...overrides,
    };
}

export async function assertRejects(
    fn: () => Promise<unknown>,
    predicate: (e: unknown) => boolean,
    msg: string,
): Promise<void> {
    try {
        await fn();
        throw new Error(`FAIL: ${msg} (did not reject)`);
    } catch (e) {
        if (!predicate(e)) throw new Error(`FAIL: ${msg}: ${e instanceof Error ? e.message : String(e)}`);
    }
}
