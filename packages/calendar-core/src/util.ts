export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function asArray(value: unknown): unknown[] | undefined {
    return Array.isArray(value) ? value : undefined;
}

/** Join a base URL and a path without doubling or dropping slashes. `./` stays `./`. */
export function joinUrl(base: string, path: string): string {
    const trimmedPath = path.replace(/^\/+/, '');
    if (base === './' || base === '.') return `./${trimmedPath}`;
    const trimmedBase = base.replace(/\/+$/, '');
    return `${trimmedBase}/${trimmedPath}`;
}

export function utf8ByteLength(text: string): number {
    let n = 0;
    for (const ch of text) {
        const code = ch.codePointAt(0) ?? 0;
        if (code <= 0x7f) n += 1;
        else if (code <= 0x7ff) n += 2;
        else if (code <= 0xffff) n += 3;
        else n += 4;
    }
    return n;
}

export function fnv1a(text: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
}

export function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

export function utcYmd(ms: number): string {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function startOfUtcDay(ms: number): number {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
