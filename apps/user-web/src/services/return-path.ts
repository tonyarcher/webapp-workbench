export function safeReturnPath(raw: string | null): string | null {
    if (raw === null || raw === '' || raw.length > 256) return null;
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
