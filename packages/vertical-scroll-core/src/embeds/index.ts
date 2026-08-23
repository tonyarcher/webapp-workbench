import type {EmbedProvider} from './types'
import {INSTAGRAM} from './instagram'
import {REDGIFS} from './redgifs'
import {TIKTOK} from './tiktok'
import {YOUTUBE} from './youtube'
import {stripImageProxy} from './util'

export type {EmbedProvider, EmbedPlayerEvent} from './types'

/** All built-in embed providers, in matching priority order. */
export const EMBED_PROVIDERS: readonly EmbedProvider[] = [REDGIFS, TIKTOK, INSTAGRAM, YOUTUBE]

const registeredProviders: EmbedProvider[] = [REDGIFS, TIKTOK, INSTAGRAM, YOUTUBE]

export function registerEmbedProvider(provider: EmbedProvider): void {
    registeredProviders.push(provider)
}

function providerForDecoded(decoded: string): EmbedProvider | null {
    for (const provider of registeredProviders) {
        if (provider.id(decoded) !== null) return provider
    }
    return null
}

/**
 * Returns the provider that owns a page URL (decoding instance image proxies
 * first), or null when the URL isn't an embed-required site.
 */
export function embedProviderForUrl(url: string | null): EmbedProvider | null {
    if (!url) return null
    return providerForDecoded(stripImageProxy(url))
}

/** Official embed iframe URL for a page URL, or null when not an embed site. */
export function embedUrlFor(url: string | null): string | null {
    if (!url) return null
    const decoded = stripImageProxy(url)
    const provider = providerForDecoded(decoded)
    return provider ? provider.embedUrl(decoded) : null
}

/** Static poster for the inactive placeholder, or null when the provider has none. */
export function embedPosterFor(url: string | null): string | null {
    if (!url) return null
    const decoded = stripImageProxy(url)
    const provider = providerForDecoded(decoded)
    if (!provider) return null
    const id = provider.id(decoded)
    return id ? provider.poster(id) : null
}
