const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.calendarlist',
].join(' ');

export interface GoogleAccess {
    accessToken: string;
    expiresAt: number;
}

interface TokenClient {
    requestAccessToken: (opts?: {prompt?: string}) => void;
}

interface TokenResponse {
    access_token?: string;
    expires_in?: number;
    error?: string;
}

interface GisOauth {
    initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (resp: TokenResponse) => void;
    }) => TokenClient;
}

function gisOauth(): GisOauth | undefined {
    const google = (globalThis as {google?: {accounts?: {oauth2?: GisOauth}}}).google;
    return google?.accounts?.oauth2;
}

export function loadGis(): Promise<void> {
    if (gisOauth()) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
        if (existing) {
            existing.addEventListener('load', () => resolve(), {once: true});
            existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity')), {once: true});
            return;
        }
        const script = document.createElement('script');
        script.src = GIS_SRC;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Identity'));
        document.head.appendChild(script);
    });
}

export async function requestGoogleToken(clientId: string, prompt: '' | 'consent' = 'consent'): Promise<GoogleAccess> {
    await loadGis();
    const oauth = gisOauth();
    if (!oauth) throw new Error('Google Identity is not available');
    return new Promise((resolve, reject) => {
        const client = oauth.initTokenClient({
            client_id: clientId,
            scope: SCOPES,
            callback: (resp) => {
                if (resp.error || !resp.access_token) {
                    reject(new Error(resp.error ?? 'Google sign-in failed'));
                    return;
                }
                const expiresIn = resp.expires_in ?? 3_600;
                resolve({
                    accessToken: resp.access_token,
                    expiresAt: Date.now() + expiresIn * 1_000,
                });
            },
        });
        client.requestAccessToken({prompt});
    });
}
