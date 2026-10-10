/**
 * Runtime configuration for the radio station.
 *
 * The document carries a `<script type="application/json" id="app-config">`
 * block whose `apiBase` names the API origin. The same-origin gateway deploy
 * ships it as `""` (empty = same origin); the asset-origin publish renders the
 * app's API origin into it at upload time, so the built `dist/` stays
 * host-independent and no build-time value is required.
 */

/** The JSON shape of the `#app-config` script block. */
export interface AppConfig {
    apiBase: string;
}

/** Parse the `#app-config` block text; missing, malformed, or wrong-typed input yields an empty apiBase. */
export function parseAppConfig(json: string | null | undefined): AppConfig {
    if (!json) return { apiBase: '' };
    try {
        const parsed: unknown = JSON.parse(json);
        if (parsed !== null && typeof parsed === 'object') {
            const apiBase = (parsed as { apiBase?: unknown }).apiBase;
            if (typeof apiBase === 'string') return { apiBase };
        }
    } catch {
        // Fall through to the empty default.
    }
    return { apiBase: '' };
}

/**
 * Resolve the API base: the runtime config block first, then a build/dev
 * `VITE_API_BASE`, then the relative `${BASE_URL}api` same-origin default.
 */
export function resolveApiBase(configApiBase: string, viteApiBase: string | undefined, baseUrl: string): string {
    if (configApiBase) return configApiBase;
    if (viteApiBase) return viteApiBase;
    const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${root}api`;
}

/** The parsed config for this document, set once at boot by the entry point. */
let current: AppConfig = { apiBase: '' };

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
