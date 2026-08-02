/**
 * Returns the URL only for safe schemes, null otherwise. All href/src values
 * derived from instance, post, or community data are untrusted and must pass
 * through here — a malicious post must never be able to bind `javascript:` or
 * `data:` into an attribute.
 */
export function safeUrl(url: string | null): string | null {
    if (!url) return null
    try {
        const parsed = new URL(url)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null
    } catch {
        return null
    }
}
