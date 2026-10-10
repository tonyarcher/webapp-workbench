package rssapi.web

import org.springframework.mock.env.MockEnvironment
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AppShellTest {
    @Test
    fun htmlEscapeEscapesTheFiveEntities() {
        assertEquals("a&amp;b", htmlEscape("a&b"))
        assertEquals("&lt;tag&gt;", htmlEscape("<tag>"))
        assertEquals("&quot;q&quot;", htmlEscape("\"q\""))
        assertEquals("&#39;", htmlEscape("'"))
    }

    @Test
    fun bootstrapJsonEscapesAngleBrackets() {
        assertTrue(bootstrapJson("", "").contains("\"apiBase\":\"\""))
        val hostile = bootstrapJson("https://x</script>", "")
        assertFalse(hostile.contains("</script>"))
        assertTrue(hostile.contains("\\u003c"))
    }

    @Test
    fun renderShellLinksStylesheetsFromAssetsBase() {
        val config = AppShellConfig(
            "RSS Reader",
            "desc",
            "https://api",
            "https://cdn",
            "assets/app.js",
            listOf("assets/app.css", "/assets/other.css"),
        )
        val shell = renderShell(config)
        assertTrue(shell.contains("<link rel=\"stylesheet\" href=\"https://cdn/assets/app.css\" />"), shell)
        assertTrue(shell.contains("<link rel=\"stylesheet\" href=\"https://cdn/assets/other.css\" />"), shell)
    }

    @Test
    fun renderShellLinksPwaFilesOnTheAssetOrigin() {
        val config = AppShellConfig("RSS Reader", "desc", "https://api", "https://cdn/rss-reader", "assets/app.js")
        val shell = renderShell(config)
        assertTrue(
            shell.contains("<link rel=\"manifest\" href=\"https://cdn/rss-reader/manifest.webmanifest\" />"),
            shell,
        )
        assertTrue(
            shell.contains("<link rel=\"icon\" type=\"image/svg+xml\" href=\"https://cdn/rss-reader/favicon.svg\" />"),
            shell,
        )
        assertTrue(
            shell.contains("<link rel=\"apple-touch-icon\" href=\"https://cdn/rss-reader/icon-192.png\" />"),
            shell,
        )
    }

    @Test
    fun renderShellOmitsPwaLinksWithoutAssetsBase() {
        val shell = renderShell(AppShellConfig("RSS Reader", "desc", "", "", "assets/app.js"))
        assertFalse(shell.contains("rel=\"manifest\""))
    }

    @Test
    fun renderShellOmitsEntryWhenBlank() {
        val shell = renderShell(AppShellConfig("RSS Reader", "desc", "", "", ""))
        assertTrue(shell.contains("<title>RSS Reader</title>"))
        assertTrue(shell.contains("<meta name=\"description\" content=\"desc\" />"))
        assertTrue(shell.contains("id=\"rss-bootstrap\""))
        assertTrue(shell.contains("<app-shell></app-shell>"))
        assertFalse(shell.contains("<script type=\"module\""))
        assertFalse(shell.contains("<link rel=\"stylesheet\""))
    }

    @Test
    fun renderShellIncludesEntryAndEscapes() {
        val shell = renderShell(AppShellConfig("T & T", "d <i>x</i>", "https://api", "https://cdn", "assets/app.js"))
        assertTrue(shell.contains("<title>T &amp; T</title>"))
        assertTrue(shell.contains("content=\"d &lt;i&gt;x&lt;/i&gt;\""))
        assertTrue(shell.contains("<script type=\"module\" src=\"https://cdn/assets/app.js\"></script>"))
        assertTrue(shell.contains("\"apiBase\":\"https://api\""))
    }

    @Test
    fun shellConfigDefaults() {
        val config = shellConfigFromEnv(MockEnvironment())
        assertEquals(DEFAULT_TITLE, config.title)
        assertEquals(DEFAULT_DESCRIPTION, config.description)
        assertEquals("", config.apiBase)
        assertEquals("", config.assetsBase)
        assertEquals("", config.entryName)
        assertTrue(config.cssFiles.isEmpty())
    }

    @Test
    fun shellConfigOverrides() {
        val env = MockEnvironment()
            .withProperty("SHELL_TITLE", "T")
            .withProperty("SHELL_DESCRIPTION", "D")
            .withProperty("PUBLIC_API_BASE", "https://api.example.com")
            .withProperty("ASSETS_BASE", "https://cdn.example.com")
            .withProperty("SHELL_ENTRY", "assets/app.js")
            .withProperty("SHELL_CSS", "assets/a.css, assets/b.css")
        val config = shellConfigFromEnv(env)
        assertEquals("T", config.title)
        assertEquals("D", config.description)
        assertEquals("https://api.example.com", config.apiBase)
        assertEquals("https://cdn.example.com", config.assetsBase)
        assertEquals("assets/app.js", config.entryName)
        assertEquals(listOf("assets/a.css", "assets/b.css"), config.cssFiles)
    }
}
