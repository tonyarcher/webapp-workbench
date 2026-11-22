import { API_VERSION, API_VERSION_HEADER, CSRF_HEADER, fetchCsrfToken } from 'user-client';
import { appConfig, resolveIdentityBase } from './config';

export interface McpClientInfo {
    id: string;
    label: string;
    writesEnabled: boolean;
    createdAt: string;
}

export interface McpIssuedClient {
    id: string;
    label: string;
    token: string;
}

function identityBase(): string {
    return resolveIdentityBase(appConfig().identityBase, location.origin);
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { [API_VERSION_HEADER]: API_VERSION };
    if (init.method === 'POST') {
        const csrf = await fetchCsrfToken({ base: identityBase() });
        if (csrf) headers[CSRF_HEADER] = csrf;
    }
    if (typeof init.body === 'string') headers['Content-Type'] = 'application/json';
    const res = await fetch(`${identityBase()}${path}`, {
        ...init,
        credentials: 'include',
        headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) throw new Error(`identity request failed: ${res.status}`);
    return (await res.json()) as T;
}

export async function listMcpClients(): Promise<McpClientInfo[]> {
    const res = await call<{ clients: McpClientInfo[] }>('/oauth/mcp/clients');
    return res.clients;
}

export async function issueMcpClient(label: string): Promise<McpIssuedClient> {
    return call<McpIssuedClient>('/oauth/mcp/clients', {
        method: 'POST',
        body: JSON.stringify({ label }),
    });
}

export async function revokeMcpClient(id: string): Promise<void> {
    await call('/oauth/mcp/clients/' + encodeURIComponent(id), { method: 'DELETE' });
}

export async function setMcpConsent(id: string, enabled: boolean): Promise<void> {
    await call('/oauth/mcp/clients/' + encodeURIComponent(id) + '/consent', {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
    });
}
