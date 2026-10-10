package rssapi.web

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.springframework.core.env.Environment

/**
 * The reader's HTML shell, rendered by the JVM so the document carries
 * server-side OG/meta tags and a bootstrap blob the client hydrates. In the
 * S3 object-store model this is what the API serves where a static nginx image
 * served `index.html`; the hashed build assets move to the object store's own
 * origin and the client points back at this API cross-origin.
 */

internal const val DEFAULT_TITLE: String = "RSS Reader"
internal const val DEFAULT_DESCRIPTION: String = "Your feeds, one reader."

/** The PWA manifest Vite copies to the asset origin's base path. */
internal const val MANIFEST_NAME: String = "manifest.webmanifest"

internal data class AppShellConfig(
    val title: String,
    val description: String,
    val apiBase: String,
    val assetsBase: String,
    val entryName: String,
    val cssFiles: List<String> = emptyList(),
)

/** Initial state handed to the client as JSON under `#rss-bootstrap`. */
@Serializable
internal data class BootstrapState(val apiBase: String, val assetsBase: String)

/** Escape text for an HTML text node or attribute value. */
internal fun htmlEscape(value: String): String = value
    .replace("&", "&amp;")
    .replace("<", "&lt;")
    .replace(">", "&gt;")
    .replace("\"", "&quot;")
    .replace("'", "&#39;")

/**
 * The bootstrap blob, safe to embed inside a `<script type="application/json">`
 * block: `<` becomes the JSON escape `\u003c` so a value cannot close the tag.
 */
internal fun bootstrapJson(apiBase: String, assetsBase: String): String =
    Json.encodeToString(BootstrapState.serializer(), BootstrapState(apiBase, assetsBase)).replace("<", "\\u003c")

/** The module entry tag, or empty when no entry is configured (pure meta shell). */
private fun entryScript(config: AppShellConfig): String {
    val name = config.entryName.takeIf { it.isNotBlank() } ?: return ""
    val base = config.assetsBase.trimEnd('/')
    return "<script type=\"module\" src=\"${htmlEscape("$base/${name.trimStart('/')}")}\"></script>"
}

/**
 * The favicon, touch icon, and web manifest links the shell replaces from
 * Vite's index.html. Emitted only on the asset origin (`assetsBase` set); the
 * same-origin gateway deploy still serves the static nginx image's index.html.
 */
private fun pwaLinks(config: AppShellConfig): List<String> {
    if (config.assetsBase.isBlank()) return emptyList()
    val base = config.assetsBase.trimEnd('/')
    fun href(name: String): String = htmlEscape("$base/$name")
    return listOf(
        "<link rel=\"icon\" type=\"image/svg+xml\" href=\"${href("favicon.svg")}\" />",
        "<link rel=\"apple-touch-icon\" href=\"${href("icon-192.png")}\" />",
        "<link rel=\"manifest\" href=\"${href(MANIFEST_NAME)}\" />",
    )
}

/**
 * One `<link rel="stylesheet">` per hashed CSS file the Vite manifest lists. The
 * shell replaces Vite's index.html, so without these the app renders unstyled.
 */
private fun styleLinks(config: AppShellConfig): List<String> {
    val base = config.assetsBase.trimEnd('/')
    return config.cssFiles.filter { it.isNotBlank() }.map { name ->
        "<link rel=\"stylesheet\" href=\"${htmlEscape("$base/${name.trimStart('/')}")}\" />"
    }
}

private fun shellHead(config: AppShellConfig, title: String, description: String): String = buildString {
    appendLine("<!doctype html>")
    appendLine("<html lang=\"en\">")
    appendLine("<head>")
    appendLine("<meta charset=\"utf-8\" />")
    appendLine("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />")
    appendLine("<meta name=\"theme-color\" content=\"#2563eb\" />")
    appendLine("<title>$title</title>")
    appendLine("<meta name=\"description\" content=\"$description\" />")
    appendLine("<meta property=\"og:title\" content=\"$title\" />")
    appendLine("<meta property=\"og:description\" content=\"$description\" />")
    appendLine("<meta property=\"og:type\" content=\"website\" />")
    appendLine("<meta property=\"og:site_name\" content=\"RSS Reader\" />")
    pwaLinks(config).forEach { appendLine(it) }
    styleLinks(config).forEach { appendLine(it) }
    appendLine("</head>")
}

private fun shellBody(bootstrap: String, entry: String): String = buildString {
    appendLine("<body>")
    appendLine("<app-shell></app-shell>")
    appendLine("<script type=\"application/json\" id=\"rss-bootstrap\">$bootstrap</script>")
    if (entry.isNotEmpty()) appendLine(entry)
    appendLine("</body>")
    appendLine("</html>")
}

internal fun renderShell(config: AppShellConfig): String {
    val title = htmlEscape(config.title)
    val description = htmlEscape(config.description)
    val bootstrap = bootstrapJson(config.apiBase, config.assetsBase)
    return shellHead(config, title, description) + shellBody(bootstrap, entryScript(config))
}

/** Comma/space-separated values, trimmed and blank-filtered. */
private fun splitList(raw: String?): List<String> =
    raw.orEmpty().split(',', ' ', '\t', '\n').map { it.trim() }.filter { it.isNotEmpty() }

/** Shell config from the environment; unset values keep the same-origin defaults. */
internal fun shellConfigFromEnv(env: Environment): AppShellConfig = AppShellConfig(
    title = env.getProperty("SHELL_TITLE") ?: DEFAULT_TITLE,
    description = env.getProperty("SHELL_DESCRIPTION") ?: DEFAULT_DESCRIPTION,
    apiBase = env.getProperty("PUBLIC_API_BASE") ?: "",
    assetsBase = env.getProperty("ASSETS_BASE") ?: "",
    entryName = env.getProperty("SHELL_ENTRY") ?: "",
    cssFiles = splitList(env.getProperty("SHELL_CSS")),
)
