// Helpers for handling the Vite base path (e.g. `/` in dev/tests, `/baseball/`
// in production). The app is served under a subpath in production, so paths
// observed from the browser include the base prefix, while the paths used by
// the app internally (and passed to browser history) are relative to the app
// root. All helpers are pure and take the base as an argument for testability.

export function normalizeBasePath(base: string): string {
  let b = base || '/';
  if (!b.startsWith('/')) b = `/${b}`;
  if (b.length > 1 && b.endsWith('/')) b = b.slice(0, -1);
  return b;
}

export function normalizePath(path: string): string {
  if (path === '' || path === '/') return '/';
  const p = path.endsWith('/') ? path.slice(0, -1) : path;
  return p.startsWith('/') ? p : `/${p}`;
}

export function stripBasePath(pathname: string, base: string): string {
  const basePath = normalizeBasePath(base);
  if (basePath === '/') return normalizePath(pathname);
  if (pathname === basePath) return '/';
  if (pathname.startsWith(`${basePath}/`)) {
    return normalizePath(pathname.slice(basePath.length));
  }
  return normalizePath(pathname);
}

export function addBasePath(path: string, base: string): string {
  const basePath = normalizeBasePath(base);
  const stripped = normalizePath(path);
  if (basePath === '/') return stripped;
  if (stripped === '/') return basePath;
  return `${basePath}${stripped}`;
}
