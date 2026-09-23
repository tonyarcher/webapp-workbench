// Server AI smoke: server summarize preferred, local fallback on failure or no server.
import { assert } from './smoke-assert';

// ---- server AI summarize: use when available, local fallback ----
{
    const { resetServerAi, summarizeBest, summarizeWithServer } = await import('../src/ai');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    const realLM = (shims as Record<string, unknown>)['LanguageModel'];
    shims['window'] = { dispatchEvent: () => false };
    const store = shims['localStorage'] as { setItem: (k: string, v: string) => void } | undefined;
    store?.setItem(
        'rss.auth.tokens',
        JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
    );
    const seen: Array<{ url: string; auth: string | null; body: string | null }> = [];
    let summarizeMode: 'ok' | 'fail' = 'ok';
    let serverAvailable = true;
    shims['fetch'] = async (url: unknown, init?: { headers?: Record<string, string>; body?: unknown }) => {
        const path = String(url);
        seen.push({
            url: path,
            auth: init?.headers?.['Authorization'] ?? null,
            body: typeof init?.body === 'string' ? init.body : null,
        });
        if (path.endsWith('/api/ai/status')) {
            return new Response(JSON.stringify({ available: serverAvailable, provider: 'ollama', model: 'qwen3:8b' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (path.endsWith('/api/ai/summarize')) {
            if (summarizeMode === 'fail') {
                return new Response(JSON.stringify({ error: 'internal error' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return new Response(JSON.stringify({ summary: '- server' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        throw new Error('unexpected ' + path);
    };
    (shims as Record<string, unknown>)['LanguageModel'] = {
        availability: async () => 'available',
        create: async () => ({ prompt: async () => 'LOCAL', destroy: () => {} }),
    };
    try {
        resetServerAi();
        assert((await summarizeWithServer('T', 'body')) === '- server', 'server summarize returns model text');
        assert(
            seen.some((s) => s.url.endsWith('/api/ai/summarize') && (s.body?.includes('"title":"T"') ?? false)),
            'server summarize posts title and text',
        );
        assert(
            seen.some((s) => s.url.endsWith('/api/ai/summarize') && (s.body?.includes('"length":"standard"') ?? false)),
            'server summarize posts the default length',
        );
        assert(
            seen.every((s) => s.auth === 'Bearer test-access'),
            'server AI sends the Bearer token',
        );

        resetServerAi();
        assert((await summarizeBest('T', 'body')) === '- server', 'best uses the server when available');

        summarizeMode = 'fail';
        resetServerAi();
        assert((await summarizeBest('T', 'body')) === 'LOCAL', 'best falls back to local when the server fails');

        summarizeMode = 'ok';
        serverAvailable = false;
        resetServerAi();
        const before = seen.length;
        assert((await summarizeBest('T', 'body')) === 'LOCAL', 'best uses local when no server is configured');
        assert(
            !seen.slice(before).some((s) => s.url.endsWith('/api/ai/summarize')),
            'no summarize call without a server',
        );
    } finally {
        (shims as Record<string, unknown>)['LanguageModel'] = realLM;
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}
