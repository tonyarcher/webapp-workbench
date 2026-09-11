export const USER_API_PREFIX = '/user-api';

export function healthzUrl(): string {
    return `${USER_API_PREFIX}/healthz`;
}

export function csrfUrl(): string {
    return `${USER_API_PREFIX}/v1/csrf`;
}

export function meUrl(): string {
    return `${USER_API_PREFIX}/v1/me`;
}

export function registerUrl(): string {
    return `${USER_API_PREFIX}/v1/register`;
}

export function loginUrl(): string {
    return `${USER_API_PREFIX}/v1/login`;
}

export function logoutUrl(): string {
    return `${USER_API_PREFIX}/v1/logout`;
}

export function loginTotpUrl(): string {
    return `${USER_API_PREFIX}/v1/login/totp`;
}

export function totpBeginUrl(): string {
    return `${USER_API_PREFIX}/v1/totp/begin`;
}

export function totpConfirmUrl(): string {
    return `${USER_API_PREFIX}/v1/totp/confirm`;
}

export function passkeyRegisterBeginUrl(): string {
    return `${USER_API_PREFIX}/v1/passkey/register/begin`;
}

export function passkeyRegisterFinishUrl(): string {
    return `${USER_API_PREFIX}/v1/passkey/register/finish`;
}

export function passkeyLoginBeginUrl(): string {
    return `${USER_API_PREFIX}/v1/passkey/login/begin`;
}

export function passkeyLoginFinishUrl(): string {
    return `${USER_API_PREFIX}/v1/passkey/login/finish`;
}

export function isHealthOk(body: unknown): boolean {
    if (typeof body !== 'object' || body === null || !('ok' in body)) return false;
    return body.ok === true;
}

export function readCsrf(body: unknown): string | null {
    if (typeof body !== 'object' || body === null || !('csrf' in body)) return null;
    return typeof body.csrf === 'string' && body.csrf.length > 0 ? body.csrf : null;
}

export function readMe(body: unknown): {id: string; username: string; totpEnabled: boolean; passkeyCount: number} | null {
    if (typeof body !== 'object' || body === null) return null;
    if (!('id' in body) || !('username' in body)) return null;
    if (typeof body.id !== 'string' || typeof body.username !== 'string') return null;
    const totpEnabled = 'totpEnabled' in body && body.totpEnabled === true;
    const passkeyCount = 'passkeyCount' in body && typeof body.passkeyCount === 'number' ? body.passkeyCount : 0;
    return {id: body.id, username: body.username, totpEnabled, passkeyCount};
}

export function readPasskeyBegin(body: unknown): {requestId: string; options: unknown} | null {
    if (typeof body !== 'object' || body === null) return null;
    if (!('requestId' in body) || !('options' in body)) return null;
    if (typeof body.requestId !== 'string') return null;
    return {requestId: body.requestId, options: body.options};
}

export function totpRequired(body: unknown): boolean {
    if (typeof body !== 'object' || body === null || !('totpRequired' in body)) return false;
    return body.totpRequired === true;
}

export function readTotpBegin(body: unknown): {secret: string; otpauth: string} | null {
    if (typeof body !== 'object' || body === null) return null;
    if (!('secret' in body) || !('otpauth' in body)) return null;
    if (typeof body.secret !== 'string' || typeof body.otpauth !== 'string') return null;
    return {secret: body.secret, otpauth: body.otpauth};
}

export function readBackupCodes(body: unknown): string[] | null {
    if (typeof body !== 'object' || body === null || !('backupCodes' in body)) return null;
    const codes = body.backupCodes;
    if (!Array.isArray(codes) || !codes.every((c) => typeof c === 'string')) return null;
    return codes;
}

export function readErr(body: unknown): string {
    if (typeof body !== 'object' || body === null || !('err' in body)) return 'request failed';
    const err = body.err;
    if (typeof err !== 'object' || err === null || !('message' in err)) return 'request failed';
    return typeof err.message === 'string' ? err.message : 'request failed';
}
