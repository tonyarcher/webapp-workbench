import type {IncomingMessage, ServerResponse} from 'node:http';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined | null): value is string {
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

export interface RouteCtx {
    req: IncomingMessage;
    res: ServerResponse;
    params: Record<string, string>;
    query: URLSearchParams;
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
        const part = pp[i] ?? '';
        if (part.startsWith(':')) {
            params[part.slice(1)] = safeDecode(pa[i] ?? '');
        } else if (part !== pa[i]) {
            return null;
        }
    }
    return params;
}

export async function readJsonBody(req: IncomingMessage, maxBytes = 64_000): Promise<unknown> {
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

export function sendJson(res: ServerResponse, status: number, value: unknown): void {
    const body = JSON.stringify(value);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
}

export function sendText(res: ServerResponse, status: number, body: string, filename?: string): void {
    const headers: Record<string, string> = {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': String(Buffer.byteLength(body)),
    };
    if (filename) headers['Content-Disposition'] = `attachment; filename="${filename}"`;
    res.writeHead(status, headers);
    res.end(body);
}

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

async function handleDispatch(req: IncomingMessage, res: ServerResponse, routes: Route[]): Promise<void> {
    try {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const pathname = url.pathname.replace(/(\/playlists\/[0-9a-f-]+)\.txt$/i, '$1/txt');
        const {route, params} = findMatched(routes, req.method ?? 'GET', pathname);
        if (!route) {
            sendJson(res, 404, {error: 'not found'});
            return;
        }
        const result = await route.handler({req, res, params, query: url.searchParams});
        if (!res.headersSent && result !== undefined) sendJson(res, 200, result);
    } catch (err) {
        const status = errorStatus(err);
        if (status >= 500) console.error(err);
        if (!res.headersSent) sendJson(res, status, {error: errorMessage(err, status)});
        else res.destroy();
    }
}

export function createDispatcher(routes: Route[]): (req: IncomingMessage, res: ServerResponse) => void {
    return (req, res) => {
        void handleDispatch(req, res, routes);
    };
}
