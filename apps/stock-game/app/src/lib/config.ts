export interface AppConfig {
    apiBase: string;
    identityBase: string;
}

export function parseAppConfig(json: string | null | undefined): AppConfig {
    if (!json) return { apiBase: '', identityBase: '' };
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return { apiBase: '', identityBase: '' };
    }
    if (parsed !== null && typeof parsed === 'object') {
        const o = parsed as { apiBase?: unknown; identityBase?: unknown };
        return {
            apiBase: typeof o.apiBase === 'string' ? o.apiBase : '',
            identityBase: typeof o.identityBase === 'string' ? o.identityBase : '',
        };
    }
    return { apiBase: '', identityBase: '' };
}

export function resolveApiBase(configApiBase: string, viteApiBase: string | undefined, baseUrl: string): string {
    if (configApiBase) return configApiBase;
    if (viteApiBase) return viteApiBase;
    const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${root}api`;
}

export function resolveIdentityBase(configIdentityBase: string, origin: string): string {
    return configIdentityBase || `${origin}/user-api`;
}

let current: AppConfig = { apiBase: '', identityBase: '' };

export function setAppConfig(config: AppConfig): void {
    current = config;
}

export function appConfig(): AppConfig {
    return current;
}
