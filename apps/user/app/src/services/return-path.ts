/**
 * Ceiling on an accepted return path.
 *
 * This bounds the work a hostile link can cause; it is not the open-redirect
 * defence, which is the shape checks below. A full OAuth authorize URL is the
 * longest legitimate value and runs well past 256: client_id, code_challenge,
 * method, an encoded redirect_uri, response_type, scope and state together
 * measured 287 for the log viewer, and it was silently rejected, leaving the
 * browser signed in with nowhere to go back to. 1024 leaves ample room while
 * keeping a real bound.
 */
const MAX_RETURN_PATH = 1024;

export function safeReturnPath(raw: string | null): string | null {
    if (raw === null || raw === '' || raw.length > MAX_RETURN_PATH) return null;
    if (!raw.startsWith('/')) return null;
    if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
    if (raw.includes('://') || raw.includes('\\')) return null;
    if (/[\s\u0000-\u001f]/.test(raw)) return null;
    return raw;
}

export function returnPathFromSearch(search: string): string | null {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    return safeReturnPath(params.get('return'));
}
