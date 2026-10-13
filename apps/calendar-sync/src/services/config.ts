/**
 * Runtime configuration for calendar-sync.
 *
 * The document carries a `<script type="application/json" id="app-config">`
 * block naming the API origin and the identity origin. The same-origin gateway
 * deploy ships it empty (empty = same origin); the asset-origin publish renders
 * the app's real origins into it at upload time, so the built `dist/` stays
 * host-independent and no build-time value is required. The entry point reads
 * the block once at boot and hands it to `setAppConfig`.
 */

/** The JSON shape of the `#app-config` script block. */
export interface AppConfig {
    apiBase: string;
    identityBase: string;
}

/** Parse the `#app-config` block text; missing, malformed, or wrong-typed input yields empty bases. */
export function parseAppConfig(json: string | null | undefined): AppConfig {
    if (!json) return { apiBase: '', identityBase: '' };
    try {
        const parsed: unknown = JSON.parse(json);
        if (parsed !== null && typeof parsed === 'object') {
            const o = parsed as { apiBase?: unknown; identityBase?: unknown };
            return {
                apiBase: typeof o.apiBase === 'string' ? o.apiBase : '',
                identityBase: typeof o.identityBase === 'string' ? o.identityBase : '',
            };
        }
    } catch {
        // Fall through to the empty default.
    }
    return { apiBase: '', identityBase: '' };
}

/**
 * Resolve the API base: the runtime config block first, then a build/dev
 * `VITE_API_BASE`, then the relative `${BASE_URL}api` same-origin default.
 * Under the gateway subpath that resolves to `/calendar-sync/api`.
 */
export function resolveApiBase(configApiBase: string, viteApiBase: string | undefined, baseUrl: string): string {
    if (configApiBase) return configApiBase;
    if (viteApiBase) return viteApiBase;
    const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${root}api`;
}

/**
 * Resolve the identity base: the runtime config block first, then the
 * same-origin `/user-api` default. The asset origin must name it, because the
 * identity service runs on the gateway, so `location.origin` there is the asset
 * origin, where no `/user-api` is routed and sign-in would fail.
 */
export function resolveIdentityBase(configIdentityBase: string, origin: string): string {
    return configIdentityBase || `${origin}/user-api`;
}

/** The parsed config for this document, set once at boot by the entry point. */
let current: AppConfig = { apiBase: '', identityBase: '' };

/**
 * Store the runtime config. The entry point owns the DOM read, so
 * `src/services/` stays free of DOM and remains pure and testable.
 */
export function setAppConfig(config: AppConfig): void {
    current = config;
}

/** The runtime config set at boot; the empty defaults until then. */
export function appConfig(): AppConfig {
    return current;
}
