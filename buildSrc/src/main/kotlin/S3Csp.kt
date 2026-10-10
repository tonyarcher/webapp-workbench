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
)

/**
 * The asset-origin CSP policy for one app, keyed by app id like [S3_PWA_FILES].
 * The asset origin is a separate browser origin from the API origin, so
 * `'self'` below means the asset origin, not the gateway. [Emit] names the
 * exact connect-src/media-src sources and any widening of the fixed
 * script/style/font sources — every source read from that app's client source,
 * never guessed. [Omit] means the document ships no CSP: the app reaches
 * origins that cannot be stated accurately, and the same-origin deploy sets no
 * CSP, so omitting is a non-regression.
 */
private sealed interface CspPolicy {
    data class Emit(
        val connectSrc: List<String> = emptyList(),
        val mediaSrc: List<String> = emptyList(),
        val scriptSrc: List<String> = listOf("'self'"),
        val styleSrc: List<String> = listOf("'self'"),
        val fontSrc: List<String> = emptyList(),
    ) : CspPolicy

    data object Omit : CspPolicy
}

private val S3_CSP: Map<String, CspPolicy> = mapOf(
    // Client-only apps whose only cross-origin loads are the Google Fonts
    // stylesheet and its font files.
    "baseball" to CspPolicy.Emit(
        styleSrc = listOf("'self'", "https://fonts.googleapis.com"),
        fontSrc = listOf("https://fonts.gstatic.com"),
    ),
    "basketball" to CspPolicy.Emit(
        styleSrc = listOf("'self'", "https://fonts.googleapis.com"),
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
            // `<identityBase>/oauth/token` call matches.
            val cross = listOfNotNull(
                app.apiBase.takeIf { it.isNotEmpty() },
                app.identityBase.takeIf { it.isNotEmpty() },
            )
            val connect = cross + policy.connectSrc
            buildList {
                add("default-src 'self'")
                add("script-src ${policy.scriptSrc.joinToString(" ")}")
                add("style-src ${policy.styleSrc.joinToString(" ")}")
                if (policy.fontSrc.isNotEmpty()) add("font-src ${policy.fontSrc.joinToString(" ")}")
                if (connect.isNotEmpty()) add("connect-src ${connect.joinToString(" ")}")
                if (policy.mediaSrc.isNotEmpty()) add("media-src ${policy.mediaSrc.joinToString(" ")}")
                add("img-src 'self' data: https:")
            }.joinToString("; ")
        }
    }
}
