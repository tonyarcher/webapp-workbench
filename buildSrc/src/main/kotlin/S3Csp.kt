package workbench

/**
 * One static app's asset-origin descriptor: its id, public base path (also the
 * S3 key suffix and the gateway subpath), its built dist/ directory, and the
 * pieces the catalog does not carry — the PWA file names and the cross-origin
 * API origin. [manifest] and [icons] are null/empty when the app ships no such
 * files; [swJs] is false when it ships no service worker.
 */
data class S3App(
    val id: String,
    val basePath: String,
    val distDir: String,
    val apiBase: String,
    val identityBase: String = "",
    val manifest: String? = null,
    val swJs: Boolean = false,
    val icons: List<String> = emptyList(),
)

/**
 * PWA files per app id. These are S3-deploy specifics, not catalog data: the
 * catalog's `basePath` covers the app's existence and subpath, while the
 * service-worker, manifest, and icon file names are what `assetServerBlock`
 * must serve explicitly so the document location does not swallow them. A new
 * file added to an app's `public/` belongs here too.
 */
internal data class PwaFiles(val manifest: String?, val swJs: Boolean, val icons: List<String>)

internal val S3_PWA_FILES: Map<String, PwaFiles> = mapOf(
    "rss-reader" to PwaFiles("manifest.webmanifest", true, listOf("favicon.svg", "icon-192.png", "icon-512.png")),
    "baseball" to PwaFiles("manifest.json", true, listOf("favicon.svg", "icons.svg")),
    "basketball" to PwaFiles("manifest.json", true, listOf("favicon.svg")),
    "stock-game" to PwaFiles(null, false, emptyList()),
    "lemmy-vertical-scroll" to
        PwaFiles("manifest.webmanifest", true, listOf("icon.svg", "icon-192.png", "icon-512.png")),
    "clipstack" to PwaFiles("manifest.webmanifest", true, listOf("icon.svg")),
    "calendar-sync" to PwaFiles("manifest.webmanifest", true, listOf("icon.svg")),
    "radio-station" to PwaFiles("manifest.webmanifest", true, listOf("icon.svg")),
    "fitness" to PwaFiles("manifest.webmanifest", true, listOf("icon.svg")),
    "coldwater" to PwaFiles(null, false, listOf("favicon.svg")),
)

/**
 * The asset-origin CSP policy for one app, keyed by app id like [S3_PWA_FILES].
 * The asset origin is a separate browser origin from the API origin, so
 * `'self'` below means the asset origin, not the gateway. [Emit] names the
 * exact connect-src/media-src sources and any widening of the script/font
 * sources — every source read from that app's client source, never guessed.
 * [Omit] means the document ships no CSP: the app reaches
 * origins that cannot be stated accurately, and the same-origin deploy sets no
 * CSP, so omitting is a non-regression.
 */
private sealed interface CspPolicy {
    data class Emit(
        val connectSrc: List<String> = emptyList(),
        val mediaSrc: List<String> = emptyList(),
        val scriptSrc: List<String> = listOf("'self'"),
        // 'unsafe-inline' is the honest default, not a shortcut: every shipped
        // client renders inline styles one way or another. lit-html commits
        // `style="..."` attributes through setAttribute, which style-src
        // governs — virtualized list positioning (rss-reader, radio-station,
        // baseball), meter and progress widths (radio-station,
        // calendar-sync), a trade-form hint (stock-game) — and four documents
        // carry an inline <style> background guard in index.html. A style-src
        // without it breaks that markup at load time; several apps shipped in
        // exactly that broken state before this default. Scripts stay 'self'.
        val styleSrc: List<String> = listOf("'self'", "'unsafe-inline'"),
        val fontSrc: List<String> = emptyList(),
        val frameSrc: List<String> = emptyList(),
    ) : CspPolicy

    data object Omit : CspPolicy
}

private val S3_CSP: Map<String, CspPolicy> = mapOf(
    // Client-only apps whose only cross-origin loads are the Google Fonts
    // stylesheet and its font files. Their style-src overrides the default
    // only to add the Fonts origin — an override replaces the default list,
    // so 'unsafe-inline' must be restated here (see CspPolicy.Emit).
    "baseball" to CspPolicy.Emit(
        styleSrc = listOf("'self'", "'unsafe-inline'", "https://fonts.googleapis.com"),
        fontSrc = listOf("https://fonts.gstatic.com"),
    ),
    "basketball" to CspPolicy.Emit(
        styleSrc = listOf("'self'", "'unsafe-inline'", "https://fonts.googleapis.com"),
        fontSrc = listOf("https://fonts.gstatic.com"),
    ),
    // The reader reaches its API origin (PUBLIC_API_BASE, joined at render
    // time), the identity token endpoint on the document origin ('self'), and
    // the two CORS proxies it uses to fetch feed text.
    "rss-reader" to CspPolicy.Emit(
        connectSrc = listOf("'self'", "https://api.allorigins.win", "https://corsproxy.io"),
    ),
    // stock-game, fitness and radio-station each reach their own API origin
    // (STOCK_GAME_API_BASE / FITNESS_API_BASE / RADIO_API_BASE, joined at
    // render time) plus the document origin ('self'), which is where their
    // BASE_URL-relative calls and stock-game's identity token endpoint land
    // until their clients read the rendered config block.
    "stock-game" to CspPolicy.Emit(connectSrc = listOf("'self'")),
    "fitness" to CspPolicy.Emit(connectSrc = listOf("'self'")),
    "radio-station" to CspPolicy.Emit(connectSrc = listOf("'self'")),
    // calendar-sync reaches its own API origin and the identity base (both
    // joined at render time), plus Google: the GIS script and its token-flow
    // iframe (frame-src — the popup is an accounts.google.com iframe, and
    // default-src 'self' would block it) and the Calendar insert calls.
    // Its style-src is the default: lit style attributes plus the inline
    // loading-state <style> in its document. Scripts stay 'self' — the GIS
    // origin above is the only script widening, and the same-origin deploy
    // sets no CSP at all, so the policy is a non-regression either way.
    "calendar-sync" to CspPolicy.Emit(
        connectSrc = listOf("'self'", "https://www.googleapis.com"),
        scriptSrc = listOf("'self'", "https://accounts.google.com"),
        frameSrc = listOf("https://accounts.google.com"),
    ),
    // Client-only: the lake game loads no network resources beyond its own
    // bundle and styles. Lit commits an inline style attribute for the scene
    // and timer, so the default style-src carries 'unsafe-inline'.
    "coldwater" to CspPolicy.Emit(),
    // lemmy-vertical-scroll reaches user-supplied Lemmy/PieFed instances and
    // arbitrary embed/media hosts; clipstack reaches TikTok oEmbed plus
    // arbitrary embed/media hosts. Neither set is enumerable. Omit.
    "lemmy-vertical-scroll" to CspPolicy.Omit,
    "clipstack" to CspPolicy.Omit,
)

/**
 * The asset-origin Content-Security-Policy header value for one app, or null
 * when its policy omits it. An app id missing from [S3_CSP] also yields null:
 * a future app is never served a policy written for someone else.
 */
internal fun cspHeader(app: S3App): String? {
    val policy = S3_CSP[app.id] ?: return null
    return when (policy) {
        is CspPolicy.Omit -> null

        is CspPolicy.Emit -> {
            // The cross-origin API and identity origins, when the app has them,
            // lead the static connect sources (each app's own *_API_BASE key).
            // The identity base is a path-bearing source too, so its
            // `<identityBase>/oauth/token` call matches. A CSP source carrying
            // a path matches exactly that path unless it ends in a slash
            // (CSP3 §6.7.2.12), so each is normalized to a trailing slash —
            // without it `https://host/app/api` would allow that URL alone and
            // block every request beneath it.
            val cross = listOfNotNull(
                app.apiBase.takeIf { it.isNotEmpty() }?.let { cspPathSource(it) },
                app.identityBase.takeIf { it.isNotEmpty() }?.let { cspPathSource(it) },
            )
            val connect = cross + policy.connectSrc
            buildList {
                add("default-src 'self'")
                add("script-src ${policy.scriptSrc.joinToString(" ")}")
                add("style-src ${policy.styleSrc.joinToString(" ")}")
                if (policy.fontSrc.isNotEmpty()) add("font-src ${policy.fontSrc.joinToString(" ")}")
                if (policy.frameSrc.isNotEmpty()) add("frame-src ${policy.frameSrc.joinToString(" ")}")
                if (connect.isNotEmpty()) add("connect-src ${connect.joinToString(" ")}")
                if (policy.mediaSrc.isNotEmpty()) add("media-src ${policy.mediaSrc.joinToString(" ")}")
                add("img-src 'self' data: https:")
            }.joinToString("; ")
        }
    }
}

/**
 * A connect-src source for a URL that carries a path: CSP matches a
 * path-bearing source exactly, so `https://host/app/api` would block
 * `/app/api/trakt/status`. Appending the slash turns it into the prefix match
 * the client actually needs. An origin (no path) is returned unchanged.
 */
internal fun cspPathSource(url: String): String {
    val trimmed = url.trimEnd('/')
    val path = trimmed.substringAfter("://", "").substringAfter('/', "")
    return if (path.isEmpty()) trimmed else "$trimmed/"
}
