package rssapi.body

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class BodyObjectStoreConfigTest {
    @Test
    fun disabledWhenBucketBlank() {
        assertFalse(BodyObjectStoreConfig().enabled())
    }

    @Test
    fun enabledWhenBucketSet() {
        assertTrue(BodyObjectStoreConfig(bucket = "b").enabled())
    }

    @Test
    fun fromEnvReadsValues() {
        val cfg = bodyObjectStoreConfigFromEnv(
            mapOf(
                "RSS_BODY_S3_ENDPOINT" to "http://localhost:9000",
                "RSS_BODY_S3_REGION" to "us-west-2",
                "RSS_BODY_S3_BUCKET" to "bucket",
                "RSS_BODY_S3_PREFIX" to "rss/bodies/",
                "RSS_BODY_S3_ACCESS_KEY" to "ak",
                "RSS_BODY_S3_SECRET_KEY" to "sk",
                "RSS_BODY_OFFLOAD_ENABLED" to "true",
                "RSS_BODY_OFFLOAD_AFTER_DAYS" to "14",
            ),
        )
        assertEquals("http://localhost:9000", cfg.endpoint)
        assertEquals("us-west-2", cfg.region)
        assertEquals("bucket", cfg.bucket)
        assertEquals("rss/bodies", cfg.prefix)
        assertEquals("ak", cfg.accessKey)
        assertEquals("sk", cfg.secretKey)
        assertTrue(cfg.offloadEnabled)
        assertEquals(14, cfg.offloadAfterDays)
        assertTrue(cfg.enabled())
    }

    @Test
    fun fromEnvFallsBackToS3Defaults() {
        val cfg = bodyObjectStoreConfigFromEnv(
            mapOf(
                "S3_ENDPOINT" to "http://s3",
                "S3_REGION" to "eu-west-1",
                "S3_ACCESS_KEY" to "a",
                "S3_SECRET_KEY" to "s",
            ),
        )
        assertEquals("http://s3", cfg.endpoint)
        assertEquals("eu-west-1", cfg.region)
        assertEquals("a", cfg.accessKey)
        assertEquals("s", cfg.secretKey)
        assertFalse(cfg.enabled())
    }

    @Test
    fun toStringOmitsSecrets() {
        val s = BodyObjectStoreConfig(bucket = "b", accessKey = "secret", secretKey = "pw").toString()
        assertTrue("secret" !in s)
        assertTrue("pw" !in s)
        assertTrue("bucket=b" in s)
    }

    @Test
    fun envBoolVariants() {
        assertTrue(bodyObjectStoreConfigFromEnv(mapOf("RSS_BODY_OFFLOAD_ENABLED" to "1")).offloadEnabled)
        assertTrue(bodyObjectStoreConfigFromEnv(mapOf("RSS_BODY_OFFLOAD_ENABLED" to "yes")).offloadEnabled)
        assertTrue(bodyObjectStoreConfigFromEnv(mapOf("RSS_BODY_OFFLOAD_ENABLED" to "true")).offloadEnabled)
        assertFalse(bodyObjectStoreConfigFromEnv(mapOf("RSS_BODY_OFFLOAD_ENABLED" to "no")).offloadEnabled)
        assertFalse(bodyObjectStoreConfigFromEnv(mapOf("RSS_BODY_OFFLOAD_ENABLED" to "0")).offloadEnabled)
    }

    @Test
    fun envIntFallsBackOnBadValue() {
        val cfg = bodyObjectStoreConfigFromEnv(mapOf("RSS_BODY_OFFLOAD_AFTER_DAYS" to "bad"))
        assertEquals(30, cfg.offloadAfterDays)
    }
}
