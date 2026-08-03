/**
 * Resolves the final URL an instance-side image proxy is fronting, so
 * content-type inference can see the real extension. Shared by the embed
 * registry and post-media classification.
 */
export function stripImageProxy(url: string): string {
    try {
        const parsed = new URL(url)
        if (parsed.pathname.includes('/image_proxy') || parsed.pathname.includes('/proxy/image')) {
            const target = parsed.searchParams.get('url')
            if (target) return target
        }
    } catch {
        // not a URL we can parse — fall through
    }
    return url
}
