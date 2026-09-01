import type {IncomingMessage, ServerResponse} from 'node:http';

// ---- errors ----

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards path/body ids before they reach uuid-typed SQL parameters —
 *  an unparseable value would surface as a 500 cast error otherwise. */
export function isUuid(value: string | undefined | null): boolean {
    return !!value && UUID_RE.test(value);
}

export class HttpError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message);
    }
}

// ---- route types ----

export interface RouteCtx {
    req: IncomingMessage;
    res: ServerResponse;
    params: Record<string, string>;
    query: URLSearchParams;
    user: { id: string; label: string };
}

export type RouteHandler = (ctx: RouteCtx) => Promise<unknown>;

export interface Route {
    method: string;
    pattern: string;
    handler: RouteHandler;
}

export function route(method: string, pattern: string, handler: RouteHandler): Route {
    return {method, pattern, handler};
}

// ---- pattern matching ----

/** decodeURIComponent that tolerates malformed sequences (cookies/paths are
 *  attacker-controlled; a raw URIError here would 500 the request). */
function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
    const pp = pattern.split('/');
    const pa = pathname.split('/');
    if (pp.length !== pa.length) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < pp.length; i++) {
        if (pp[i].startsWith(':')) {
            params[pp[i].slice(1)] = safeDecode(pa[i]);
        } else if (pp[i] !== pa[i]) {
            return null;
        }
    }
    return params;
}

// ---- body parsing ----

export async function readJsonBody(req: IncomingMessage, maxBytes = 2_000_000): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) {
                reject(new HttpError(400, 'Request body too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            if (!body) {
                resolve(null);
                return;
            }
            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new HttpError(400, 'Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

// ---- JSON response ----

export function sendJson(res: ServerResponse, status: number, value: unknown): void {
    const body = JSON.stringify(value);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
}

// ---- cookies ----

export function parseCookies(header: string | undefined): Record<string, string> {
    if (!header) return {};
    const out: Record<string, string> = {};
    for (const pair of header.split(';')) {
        const idx = pair.indexOf('=');
        if (idx < 0) continue;
        const key = pair.slice(0, idx).trim();
        const val = pair.slice(idx + 1).trim();
        if (key) out[key] = safeDecode(val);
    }
    return out;
}

export function setCookie(res: ServerResponse, name: string, value: string, opts: string): void {
    const existing = res.getHeader('Set-Cookie');
    const cookie = `${name}=${value}; ${opts}`;
    if (Array.isArray(existing)) {
        res.setHeader('Set-Cookie', [...existing, cookie]);
    } else if (existing) {
        res.setHeader('Set-Cookie', [existing as string, cookie]);
    } else {
        res.setHeader('Set-Cookie', cookie);
    }
}

// ---- dispatcher ----

const COOKIE_OPTS = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000';

function findMatched(routes: Route[], method: string, pathname: string): {route: Route | undefined; params: Record<string, string>} {
    for (const r of routes) {
        if (r.method !== method) continue;
        const p = matchRoute(r.pattern, pathname);
        if (p === null) continue;
        return {route: r, params: p};
    }
    return {route: undefined, params: {}};
}

function errorStatus(err: unknown): number {
    return err instanceof HttpError ? err.status : 500;
}

function errorMessage(err: unknown, status: number): string {
    if (status >= 500) return 'internal error';
    if (err instanceof Error) return err.message;
    return String(err);
}

async function handleDispatch(req: IncomingMessage, res: ServerResponse, routes: Route[], ensureUser: (req: IncomingMessage, res: ServerResponse) => Promise<{id: string; label: string}>): Promise<void> {
    try {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const {route, params} = findMatched(routes, req.method ?? 'GET', url.pathname);
        if (!route) { sendJson(res, 404, {error: 'not found'}); return; }
        const user = await ensureUser(req, res);
        const result = await route.handler({req, res, params, query: url.searchParams, user});
        if (!res.headersSent && result !== undefined) sendJson(res, 200, result);
    } catch (err) {
        const status = errorStatus(err);
        if (status >= 500) console.error(err);
        if (!res.headersSent) sendJson(res, status, {error: errorMessage(err, status)});
        else res.destroy();
    }
}

export function createDispatcher(
    routes: Route[],
    ensureUser: (req: IncomingMessage, res: ServerResponse) => Promise<{id: string; label: string}>,
): (req: IncomingMessage, res: ServerResponse) => void {
    return (req, res) => { void handleDispatch(req, res, routes, ensureUser); };
}

export {COOKIE_OPTS};
