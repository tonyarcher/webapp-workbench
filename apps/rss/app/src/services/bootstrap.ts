// Reads the JVM-rendered shell's bootstrap blob (`<script type="application/json"
// id="rss-bootstrap">`). The shell carries the API origin and asset origin so the
// client hydrates against the right backend when static assets live on a CDN.
// With no blob present (the Vite dev/index.html path) both values stay empty and
// callers fall back to their relative defaults.

export interface BootstrapState {
    apiBase: string;
    assetsBase: string;
}

const EMPTY: BootstrapState = { apiBase: '', assetsBase: '' };

export function parseBootstrapJson(text: string | null | undefined): BootstrapState {
    if (!text) return EMPTY;
    try {
        const raw = JSON.parse(text) as Partial<BootstrapState>;
        return {
            apiBase: typeof raw.apiBase === 'string' ? raw.apiBase : '',
            assetsBase: typeof raw.assetsBase === 'string' ? raw.assetsBase : '',
        };
    } catch {
        return EMPTY;
    }
}

export function readBootstrap(): BootstrapState {
    if (typeof document === 'undefined') return EMPTY;
    const el = document.getElementById('rss-bootstrap');
    return parseBootstrapJson(el?.textContent ?? null);
}
