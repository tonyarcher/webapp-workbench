package workbench

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class S3SupportTest {
    /** A reader-shaped descriptor for the block-rendering tests. */
    private fun readerApp(apiBase: String): S3App = S3App(
        id = "rss-reader",
        basePath = "/rss-reader/",
        distDir = "apps/rss/app/dist",
        apiBase = apiBase,
        manifest = "manifest.webmanifest",
        swJs = true,
        icons = listOf("favicon.svg", "icon-192.png", "icon-512.png"),
    )

    @Test
    fun s3KeyPrefixJoinsPrefixAndBasePath() {
        assertEquals("apps/rss-reader", s3KeyPrefix("apps", "/rss-reader/"))
        assertEquals("rss-reader", s3KeyPrefix("", "/rss-reader/"))
        assertEquals("apps", s3KeyPrefix("apps", ""))
        assertEquals("", s3KeyPrefix("", ""))
    }

    @Test
    fun s3SyncCommandOmitsEndpointWhenBlank() {
        assertEquals(
            listOf("aws", "s3", "sync", "dist", "s3://bucket/apps/rss-reader", "--delete"),
            s3SyncCommand("bucket", "apps/rss-reader", "dist"),
        )
        assertEquals(
            listOf("aws", "s3", "sync", "dist", "s3://bucket/apps/rss-reader", "--delete"),
            s3SyncCommand("bucket", "apps/rss-reader", "dist", ""),
        )
    }

    @Test
    fun s3SyncCommandAddsEndpointUrlWhenSet() {
        assertEquals(
            listOf(
                "aws",
                "s3",
                "sync",
                "dist",
                "s3://bucket/apps/rss-reader",
                "--delete",
                "--endpoint-url",
                "http://seaweedfs:8333",
            ),
            s3SyncCommand("bucket", "apps/rss-reader", "dist", "http://seaweedfs:8333"),
        )
    }

    @Test
    fun s3StorePathJoinsBucketAndKey() {
        assertEquals("bucket/apps/rss-reader", s3StorePath("bucket", "apps", "/rss-reader/"))
        assertEquals("rss-reader", s3StorePath("", "", "/rss-reader/"))
    }

    @Test
    fun assetServerBlockIsEmptyWithoutAssetsHost() {
        assertEquals("", assetServerBlock(emptyList(), emptyMap(), false, false))
    }

    @Test
    fun assetServerBlockServesTheStoreUnderTheAppBasePath() {
        val env = mapOf(
            "ASSETS_HOST" to "assets.example.com",
            "PUBLIC_API_BASE" to "https://api.example.com",
            "S3_BUCKET" to "workbench-assets",
            "S3_PREFIX" to "apps",
        )
        val block = assetServerBlock(listOf(readerApp("https://api.example.com")), env, false, false)
        assertTrue(block.contains("server_name assets.example.com;"), block)
        // Static files, including the PWA files, come from the store.
        assertTrue(block.contains("location ^~ /rss-reader/assets/"), block)
        assertTrue(block.contains("location = /rss-reader/sw.js"), block)
        assertTrue(block.contains("location = /rss-reader/manifest.webmanifest"), block)
        assertTrue(block.contains("rewrite ^/rss-reader/(.*)\$ /workbench-assets/apps/rss-reader/\$1 break;"), block)
        assertTrue(block.contains("set \$upstream_store http://seaweedfs:8333;"), block)
        assertTrue(block.contains("proxy_pass \$upstream_store;"), block)
        // The document is Vite's static index.html from the store.
        assertTrue(block.contains("location = /rss-reader/"), block)
        assertTrue(block.contains("rewrite ^ /workbench-assets/apps/rss-reader/index.html break;"), block)
        assertTrue(block.contains("Cache-Control \"public, max-age=31536000, immutable\";"), block)
        assertTrue(block.contains("Cache-Control \"no-cache\";"), block)
        assertTrue(block.contains("script-src 'self';"), block)
        // rss-reader binds Lit style attributes in its virtualized list, so
        // the style-src default carries 'unsafe-inline' (see CspPolicy.Emit).
        assertTrue(block.contains("style-src 'self' 'unsafe-inline';"), block)
        assertTrue(block.contains("connect-src https://api.example.com"), block)
        assertFalse(block.contains("listen 443 ssl;"), block)
    }

    @Test
    fun assetServerBlockIsEmptyWithoutABucket() {
        // An asset host with no bucket has no store to front: emit nothing rather
        // than a block that rewrites to the wrong key.
        assertEquals("", assetServerBlock(emptyList(), mapOf("ASSETS_HOST" to "assets.example.com"), false, false))
    }

    @Test
    fun assetServerBlockHonorsTlsAndRedirect() {
        val env = mapOf("ASSETS_HOST" to "assets.example.com", "S3_BUCKET" to "workbench-assets")
        val apps = listOf(readerApp(""))
        val tls = assetServerBlock(apps, env, true, false)
        assertTrue(tls.contains("listen 80;"), tls)
        assertTrue(tls.contains("listen 443 ssl;"), tls)
        assertTrue(tls.contains("ssl_certificate /etc/nginx/certs/leaf.crt;"), tls)
        val redirect = assetServerBlock(apps, env, true, true)
        assertFalse(redirect.contains("listen 80;"), redirect)
        assertTrue(redirect.contains("listen 443 ssl;"), redirect)
    }

    @Test
    fun assetServerBlockEmitsOneBlockPerApp() {
        val env = mapOf(
            "ASSETS_HOST" to "assets.example.com",
            "S3_BUCKET" to "workbench-assets",
            "S3_PREFIX" to "apps",
        )
        val baseball = S3App(
            id = "baseball",
            basePath = "/baseball/",
            distDir = "apps/baseball/dist",
            apiBase = "",
            manifest = "manifest.json",
            swJs = true,
            icons = listOf("favicon.svg", "icons.svg"),
        )
        // stock-game ships no PWA files, so it gets only assets plus a document.
        val stockGame = S3App(
            id = "stock-game",
            basePath = "/stock-game/",
            distDir = "apps/stock-game/app/dist",
            apiBase = "",
        )
        val block = assetServerBlock(listOf(baseball, stockGame), env, false, false)
        // One server block, two apps' location sets.
        assertTrue(block.contains("location ^~ /baseball/assets/"), block)
        assertTrue(block.contains("location = /baseball/manifest.json"), block)
        assertTrue(block.contains("location = /baseball/sw.js"), block)
        assertTrue(block.contains("rewrite ^/baseball/(.*)\$ /workbench-assets/apps/baseball/\$1 break;"), block)
        assertTrue(block.contains("location ^~ /stock-game/assets/"), block)
        assertTrue(block.contains("location = /stock-game/"), block)
        // baseball is client-only, so it emits no connect-src; stock-game
        // reaches its document origin ('self') for BASE_URL-relative calls and
        // its identity token endpoint, so it emits connect-src 'self' (with no
        // API origin named here).
        assertFalse(block.contains("connect-src https://"), block)
        assertTrue(block.contains("connect-src 'self';"), block)
    }

    @Test
    fun assetServerBlockWidensFontsForClientOnlyApps() {
        val env = mapOf(
            "ASSETS_HOST" to "assets.example.com",
            "S3_BUCKET" to "workbench-assets",
        )
        val baseball = S3App(
            id = "baseball",
            basePath = "/baseball/",
            distDir = "apps/baseball/dist",
            apiBase = "",
        )
        val block = assetServerBlock(listOf(baseball), env, false, false)
        // 'unsafe-inline' because baseball binds Lit style attributes
        // (game-shell's event log, plate-scene); the fonts widen further.
        assertTrue(block.contains("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;"), block)
        assertTrue(block.contains("font-src https://fonts.gstatic.com;"), block)
        assertFalse(block.contains("connect-src"), block)
        assertFalse(block.contains("media-src"), block)
    }

    @Test
    fun assetServerBlockConnectsReaderToApiSelfAndProxies() {
        val env = mapOf(
            "ASSETS_HOST" to "assets.example.com",
            "PUBLIC_API_BASE" to "https://api.example.com",
            "S3_BUCKET" to "workbench-assets",
        )
        val block = assetServerBlock(listOf(readerApp("https://api.example.com")), env, false, false)
        assertTrue(
            block.contains(
                "connect-src https://api.example.com 'self' https://api.allorigins.win https://corsproxy.io;",
            ),
            block,
        )
    }

    @Test
    fun assetServerBlockOmitsCspWhenOriginsCannotBeStated() {
        val env = mapOf(
            "ASSETS_HOST" to "assets.example.com",
            "S3_BUCKET" to "workbench-assets",
        )
        val apps = listOf(
            S3App("lemmy-vertical-scroll", "/lemmy-vertical-scroll/", "apps/lemmy-vertical-scroll/dist", ""),
            S3App("clipstack", "/clipstack/", "apps/clipstack/dist", ""),
        )
        val block = assetServerBlock(apps, env, false, false)
        // Each document location still exists, but none carries a CSP header.
        assertTrue(block.contains("location = /lemmy-vertical-scroll/"), block)
        assertTrue(block.contains("location = /clipstack/"), block)
        assertFalse(block.contains("Content-Security-Policy"), block)
    }

    @Test
    fun assetServerBlockConnectsEachApiBackedAppToItsOwnOrigin() {
        val env = mapOf(
            "ASSETS_HOST" to "assets.example.com",
            "S3_BUCKET" to "workbench-assets",
        )
        val apps = listOf(
            S3App("stock-game", "/stock-game/", "apps/stock-game/app/dist", "https://api.example.com/stock-game/api"),
            S3App("fitness", "/fitness/", "apps/fitness/dist", "https://api.example.com/fitness/api"),
            S3App(
                "radio-station",
                "/radio-station/",
                "apps/radio-station/dist",
                "https://api.example.com/radio-station/api",
            ),
        )
        val block = assetServerBlock(apps, env, false, false)
        // Each app's API origin leads its connect-src, with 'self' for the
        // document-origin calls. A path-bearing source carries a trailing
        // slash, or CSP3 matches it exactly and blocks everything beneath it.
        assertTrue(
            block.contains("connect-src https://api.example.com/stock-game/api/ 'self';"),
            block,
        )
        assertTrue(
            block.contains("connect-src https://api.example.com/fitness/api/ 'self';"),
            block,
        )
        assertTrue(
            block.contains("connect-src https://api.example.com/radio-station/api/ 'self';"),
            block,
        )
    }

    @Test
    fun apiBaseEnvKeyMapsEachApiBackedApp() {
        assertEquals("PUBLIC_API_BASE", apiBaseEnvKey("rss-reader"))
        assertEquals("STOCK_GAME_API_BASE", apiBaseEnvKey("stock-game"))
        assertEquals("FITNESS_API_BASE", apiBaseEnvKey("fitness"))
        assertEquals("RADIO_API_BASE", apiBaseEnvKey("radio-station"))
        assertNull(apiBaseEnvKey("baseball"))
        assertNull(apiBaseEnvKey("lemmy-vertical-scroll"))
    }

    @Test
    fun appConfigJsonRendersAndEscapes() {
        assertEquals("""{"apiBase":"","identityBase":""}""", appConfigJson("", ""))
        assertEquals(
            """{"apiBase":"https://api.example.com","identityBase":""}""",
            appConfigJson("https://api.example.com", ""),
        )
        assertEquals("""{"apiBase":"a\"b","identityBase":""}""", appConfigJson("a\"b", ""))
    }

    @Test
    fun appConfigJsonCarriesTheIdentityBase() {
        assertEquals(
            """{"apiBase":"https://api.example.com","identityBase":"https://gw.example.com/user-api"}""",
            appConfigJson("https://api.example.com", "https://gw.example.com/user-api"),
        )
    }

    @Test
    fun expandEnvResolvesAPlaceholderAgainstTheSeed() {
        val env = mapOf("PUBLIC_ORIGIN" to "https://host.example")
        assertEquals("https://host.example/user-api", expandEnv("\${PUBLIC_ORIGIN}/user-api", env))
        assertEquals("https://literal.example/user-api", expandEnv("https://literal.example/user-api", env))
        // An unknown name is left as written rather than silently blanked.
        assertEquals("\${MISSING}/x", expandEnv("\${MISSING}/x", env))
    }

    @Test
    fun renderAppConfigReplacesTheBlockAndKeepsEverythingElse() {
        val html = """
            <!doctype html>
            <html>
            <head><script id="app-config" type="application/json">{"apiBase":""}</script></head>
            <body><script src="/assets/app.js" type="module"></script></body>
            </html>
        """.trimIndent()
        val rendered = renderAppConfig(html, "https://api.example.com", "https://gw.example.com/user-api")
        assertTrue(rendered.contains("\"apiBase\":\"https://api.example.com\""), rendered)
        assertTrue(rendered.contains("\"identityBase\":\"https://gw.example.com/user-api\""), rendered)
        assertTrue(rendered.contains("""<script src="/assets/app.js" type="module"></script>"""), rendered)
        assertFalse(rendered.contains("""{"apiBase":""}"""), rendered)
    }

    @Test
    fun renderAppConfigIsANoopWithoutTheBlock() {
        val html = "<html><body>no config</body></html>"
        assertEquals(html, renderAppConfig(html, "https://api.example.com", "https://gw.example.com/user-api"))
    }

    @Test
    fun s3CopyCommandUploadsTheDocumentOverIndexHtml() {
        assertEquals(
            listOf("aws", "s3", "cp", "rendered.html", "s3://bucket/apps/rss-reader/index.html"),
            s3CopyCommand("bucket", "apps/rss-reader", "rendered.html"),
        )
        assertEquals(
            listOf(
                "aws",
                "s3",
                "cp",
                "rendered.html",
                "s3://bucket/apps/rss-reader/index.html",
                "--endpoint-url",
                "http://seaweedfs:8333",
            ),
            s3CopyCommand("bucket", "apps/rss-reader", "rendered.html", "http://seaweedfs:8333"),
        )
    }

    @Test
    fun mcCopyCommandUploadsTheDocumentOverIndexHtml() {
        assertEquals(
            listOf("mc", "cp", "rendered.html", "workbench/bucket/apps/rss-reader/index.html"),
            mcCopyCommand("workbench", "bucket", "apps/rss-reader", "rendered.html"),
        )
    }

    @Test
    fun publishToolPrefersAwsThenMc() {
        val dir = java.nio.file.Files.createTempDirectory("path").toFile()
        try {
            assertEquals(PublishTool.NONE, publishTool(dir.absolutePath, "Linux"))
            java.io.File(dir, "mc").createNewFile()
            assertEquals(PublishTool.MC, publishTool(dir.absolutePath, "Linux"))
            java.io.File(dir, "aws").createNewFile()
            assertEquals(PublishTool.AWS, publishTool(dir.absolutePath, "Linux"))
        } finally {
            dir.deleteRecursively()
        }
    }

    @Test
    fun publishToolLooksForExeOnWindows() {
        val dir = java.nio.file.Files.createTempDirectory("path").toFile()
        try {
            java.io.File(dir, "mc").createNewFile()
            assertEquals(PublishTool.NONE, publishTool(dir.absolutePath, "Windows 10"))
            java.io.File(dir, "mc.exe").createNewFile()
            assertEquals(PublishTool.MC, publishTool(dir.absolutePath, "Windows 10"))
        } finally {
            dir.deleteRecursively()
        }
    }

    @Test
    fun publishToolIgnoresAnEmptyPath() {
        assertEquals(PublishTool.NONE, publishTool(null, "Linux"))
        assertEquals(PublishTool.NONE, publishTool("", "Linux"))
    }

    @Test
    fun mcMirrorCommandMirrorsWithDelete() {
        assertEquals(
            listOf("mc", "mirror", "--overwrite", "--remove", "dist", "workbench/bucket/apps/rss-reader"),
            mcMirrorCommand("workbench", "bucket", "apps/rss-reader", "dist"),
        )
    }

    @Test
    fun mcHostEnvCarriesEndpointAndCredentials() {
        assertEquals(
            mapOf("MC_HOST_workbench" to "http://key:secret@localhost:9000"),
            mcHostEnv("workbench", "http://localhost:9000", "key", "secret"),
        )
        assertEquals(
            mapOf("MC_HOST_workbench" to "https://k:s@seaweedfs:8333"),
            mcHostEnv("workbench", "https://seaweedfs:8333/", "k", "s"),
        )
    }

    @Test
    fun s3MakeBucketCommandAddsEndpointUrlWhenSet() {
        assertEquals(
            listOf("aws", "s3", "mb", "s3://bucket"),
            s3MakeBucketCommand("bucket"),
        )
        assertEquals(
            listOf("aws", "s3", "mb", "s3://bucket", "--endpoint-url", "http://seaweedfs:8333"),
            s3MakeBucketCommand("bucket", "http://seaweedfs:8333"),
        )
    }

    @Test
    fun mcMakeBucketCommandIgnoresExisting() {
        assertEquals(
            listOf("mc", "mb", "--ignore-existing", "workbench/bucket"),
            mcMakeBucketCommand("workbench", "bucket"),
        )
        assertEquals(
            listOf("mc", "mb", "--ignore-existing", "workbench/bucket"),
            mcMakeBucketCommand("workbench", "bucket/"),
        )
    }

    @Test
    fun alreadyOwnsBucketRecognizesExistingBucket() {
        assertFalse(alreadyOwnsBucket(""))
        assertFalse(alreadyOwnsBucket("some other error"))
        assertTrue(alreadyOwnsBucket("An error occurred (BucketAlreadyOwnedByYou)"))
        assertTrue(alreadyOwnsBucket("An error occurred (BucketAlreadyExists)"))
    }

    @Test
    fun storeUpstreamPointsAtTheSeaweedFsS3Port() {
        assertEquals("http://seaweedfs:8333", STORE_UPSTREAM)
    }
}
