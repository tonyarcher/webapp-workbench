import type {IncomingMessage, ServerResponse} from 'node:http';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const RANK: Record<LogLevel, number> = {debug: 10, info: 20, warn: 30, error: 40};

export function minLevel(): LogLevel {
    const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
    if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
    return 'info';
}

export function formatErr(err: unknown): {type: string; message: string} {
    if (err instanceof Error) return {type: err.name, message: err.message};
    return {type: 'Error', message: String(err)};
}

export function formatLog(
    service: string,
    rec: {level: LogLevel; msg: string} & Record<string, unknown>,
): string | null {
    if (RANK[rec.level] < RANK[minLevel()]) return null;
    const {level, msg, ...rest} = rec;
    const line: Record<string, unknown> = {
        ts: new Date().toISOString(),
        level,
        msg,
        service,
    };
    for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) line[key] = value;
    }
    return JSON.stringify(line);
}

export function log(
    service: string,
    rec: {level: LogLevel; msg: string} & Record<string, unknown>,
): void {
    const line = formatLog(service, rec);
    if (!line) return;
    const sink = rec.level === 'warn' || rec.level === 'error' ? console.error : console.log;
    sink(line);
}

export function parseTraceparent(header: string | undefined): {trace_id: string; span_id: string} | undefined {
    if (!header) return undefined;
    const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/i.exec(header.trim());
    if (!match?.[1] || !match[2]) return undefined;
    return {trace_id: match[1].toLowerCase(), span_id: match[2].toLowerCase()};
}

function headerLine(req: IncomingMessage, name: string): string | undefined {
    const raw = req.headers[name];
    return Array.isArray(raw) ? raw[0] : raw;
}

export function requestIdFrom(req: IncomingMessage): {request_id: string; trace_id?: string; span_id?: string} {
    const incoming = headerLine(req, 'x-request-id');
    const traced = parseTraceparent(headerLine(req, 'traceparent'));
    const request_id = incoming && incoming.length <= 128 ? incoming : traced?.trace_id ?? crypto.randomUUID();
    return traced ? {request_id, trace_id: traced.trace_id, span_id: traced.span_id} : {request_id};
}

export function attachRequestLog(service: string, req: IncomingMessage, res: ServerResponse): void {
    const ids = requestIdFrom(req);
    res.setHeader('X-Request-ID', ids.request_id);
    const started = Date.now();
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    const health = path === '/healthz' || path === '/health';
    res.on('finish', () => {
        const status = res.statusCode;
        const level: LogLevel = status >= 500 ? 'error' : health ? 'debug' : 'info';
        log(service, {
            level,
            msg: 'request',
            method: req.method ?? 'GET',
            path,
            status,
            duration_ms: Date.now() - started,
            ...ids,
        });
    });
}
