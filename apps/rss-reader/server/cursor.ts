// ---- opaque keyset cursor encode/decode ----

function base64UrlEncode(data: string): string {
    return Buffer.from(data, 'utf8').toString('base64url');
}

function base64UrlDecode(encoded: string): string | null {
    try {
        return Buffer.from(encoded, 'base64url').toString('utf8');
    } catch {
        return null;
    }
}

export interface CursorPayload {
    k: number | string;
    id: string;
}

export function encodeCursor(payload: CursorPayload): string {
    return base64UrlEncode(JSON.stringify(payload));
}

export function decodeCursor(encoded: string): CursorPayload | null {
    const json = base64UrlDecode(encoded);
    if (!json) return null;
    try {
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed.id === 'string' && (typeof parsed.k === 'number' || typeof parsed.k === 'string')) {
            return parsed as CursorPayload;
        }
        return null;
    } catch {
        return null;
    }
}
