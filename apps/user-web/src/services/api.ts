export const USER_API_PREFIX = '/user-api';

export function healthzUrl(): string {
    return `${USER_API_PREFIX}/healthz`;
}

export function isHealthOk(body: unknown): boolean {
    if (typeof body !== 'object' || body === null || !('ok' in body)) return false;
    return body.ok === true;
}
