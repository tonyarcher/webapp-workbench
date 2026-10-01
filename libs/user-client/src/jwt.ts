export function parseJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    try {
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        const parsed: unknown = JSON.parse(json);
        if (typeof parsed !== 'object' || parsed === null) return null;
        return parsed as Record<string, unknown>;
    } catch {
        return null;
    }
}
