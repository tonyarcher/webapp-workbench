// MCP credentials are issued by identity: CSRF on POST, version header, no token echoed in lists.
import { API_VERSION_HEADER, CSRF_HEADER } from 'user-client';
import { setAppConfig } from '../src/services/config';
import { issueMcpClient, listMcpClients, revokeMcpClient, setMcpConsent } from '../src/services/api';
import { assert } from './smoke-assert';

const shims = globalThis as Record<string, unknown>;
const realFetch = shims['fetch'];
const calls: Array<{ url: string; method: string; version: string | null; csrf: string | null; body: string | null }> =
    [];
shims['location'] = { origin: 'https://reader.test' };
setAppConfig({ apiBase: '', identityBase: 'https://id.test/user-api' });
shims['fetch'] = async (url: unknown, init?: { method?: string; headers?: Record<string, string>; body?: unknown }) => {
    const path = String(url);
    calls.push({
        url: path,
        method: init?.method ?? 'GET',
        version: init?.headers?.[API_VERSION_HEADER] ?? null,
        csrf: init?.headers?.[CSRF_HEADER] ?? null,
        body: typeof init?.body === 'string' ? init.body : null,
    });
    let body: unknown = { ok: true };
    if (path.endsWith('/csrf')) body = { csrf: 'csrf-token' };
    else if (path.endsWith('/oauth/mcp/clients') && (init?.method ?? 'GET') === 'GET') {
        body = { clients: [{ id: 'c1', label: 'desk', writesEnabled: false, createdAt: '' }] };
    } else if (path.endsWith('/oauth/mcp/clients')) {
        body = { id: 'c1', label: 'desk', token: 'raw-token-once' };
    }
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
};

try {
    const issued = await issueMcpClient('desk');
    assert(issued.token === 'raw-token-once', 'identity issues the one-time token');
    assert(
        calls[1]?.url.startsWith('https://id.test/user-api/oauth/mcp/clients'),
        'issue calls identity, not the reader API',
    );
    assert(calls[1]?.csrf === 'csrf-token', 'issue echoes the CSRF token');
    const clients = await listMcpClients();
    assert(clients.length === 1 && clients[0]!.id === 'c1', 'list returns client metadata only');
    await setMcpConsent('c1', true);
    assert(calls[3]?.method === 'PATCH' && calls[3]?.body === '{"enabled":true}', 'consent is an explicit patch');
    await revokeMcpClient('c1');
    assert(calls[4]?.method === 'DELETE', 'revoke deletes the identity-side client');
    assert(
        calls.every((c) => c.version === '1'),
        'every MCP management call sends the API version',
    );
} finally {
    shims['fetch'] = realFetch;
    delete shims['location'];
}
