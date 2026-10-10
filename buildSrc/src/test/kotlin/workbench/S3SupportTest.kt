package workbench

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class S3SupportTest {
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
        assertEquals("", assetServerBlock(emptyMap(), false, false))
    }

    @Test
    fun assetServerBlockServesTheStoreUnderTheAppBasePath() {
        val env = mapOf(
            "ASSETS_HOST" to "assets.example.com",
            "PUBLIC_API_BASE" to "https://api.example.com",
            "S3_BUCKET" to "workbench-assets",
            "S3_PREFIX" to "apps",
        )
        val block = assetServerBlock(env, false, false)
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
        assertTrue(block.contains("style-src 'self';"), block)
        assertTrue(block.contains("connect-src https://api.example.com"), block)
        assertFalse(block.contains("listen 443 ssl;"), block)
    }

    @Test
    fun assetServerBlockIsEmptyWithoutABucket() {
        // An asset host with no bucket has no store to front: emit nothing rather
        // than a block that rewrites to the wrong key.
        assertEquals("", assetServerBlock(mapOf("ASSETS_HOST" to "assets.example.com"), false, false))
    }

    @Test
    fun assetServerBlockHonorsTlsAndRedirect() {
        val env = mapOf("ASSETS_HOST" to "assets.example.com", "S3_BUCKET" to "workbench-assets")
        val tls = assetServerBlock(env, true, false)
        assertTrue(tls.contains("listen 80;"), tls)
        assertTrue(tls.contains("listen 443 ssl;"), tls)
        assertTrue(tls.contains("ssl_certificate /etc/nginx/certs/leaf.crt;"), tls)
        val redirect = assetServerBlock(env, true, true)
        assertFalse(redirect.contains("listen 80;"), redirect)
        assertTrue(redirect.contains("listen 443 ssl;"), redirect)
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
