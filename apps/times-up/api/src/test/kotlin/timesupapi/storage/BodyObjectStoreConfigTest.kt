package timesupapi.storage
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
                "TIMES_UP_BODY_S3_ENDPOINT" to "http://localhost:9000",
                "TIMES_UP_BODY_S3_REGION" to "us-west-2",
                "TIMES_UP_BODY_S3_BUCKET" to "bucket",
                "TIMES_UP_BODY_S3_PREFIX" to "times-up/bodies/",
                "TIMES_UP_BODY_S3_ACCESS_KEY" to "ak",
                "TIMES_UP_BODY_S3_SECRET_KEY" to "sk",
                "TIMES_UP_BODY_OFFLOAD_ENABLED" to "true",
                "TIMES_UP_BODY_OFFLOAD_AFTER_DAYS" to "14",
            ),
        )
        assertEquals("http://localhost:9000", cfg.endpoint)
        assertEquals("us-west-2", cfg.region)
        assertEquals("bucket", cfg.bucket)
        assertEquals("times-up/bodies", cfg.prefix)
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
    fun fromEnvAcceptsLegacyKeys() {
        val cfg = bodyObjectStoreConfigFromEnv(
            mapOf(
                "RSS_BODY_S3_BUCKET" to "legacy-bucket",
                "RSS_BODY_S3_PREFIX" to "legacy/bodies",
                "RSS_EXCERPT_S3_PREFIX" to "legacy/excerpts",
                "RSS_BODY_OFFLOAD_ENABLED" to "true",
            ),
        )
        assertEquals("legacy-bucket", cfg.bucket)
        assertEquals("legacy/bodies", cfg.prefix)
        assertEquals("legacy/excerpts", cfg.excerptPrefix)
        assertTrue(cfg.offloadEnabled)
    }

    @Test
    fun newEnvironmentKeysWinOverLegacy() {
        val cfg = bodyObjectStoreConfigFromEnv(
            mapOf(
                "TIMES_UP_BODY_S3_BUCKET" to "new-bucket",
                "RSS_BODY_S3_BUCKET" to "legacy-bucket",
                "TIMES_UP_BODY_OFFLOAD_ENABLED" to "false",
                "RSS_BODY_OFFLOAD_ENABLED" to "true",
            ),
        )
        assertEquals("new-bucket", cfg.bucket)
        assertFalse(cfg.offloadEnabled)
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
        assertTrue(bodyObjectStoreConfigFromEnv(mapOf("TIMES_UP_BODY_OFFLOAD_ENABLED" to "1")).offloadEnabled)
        assertTrue(bodyObjectStoreConfigFromEnv(mapOf("TIMES_UP_BODY_OFFLOAD_ENABLED" to "yes")).offloadEnabled)
        assertTrue(bodyObjectStoreConfigFromEnv(mapOf("TIMES_UP_BODY_OFFLOAD_ENABLED" to "true")).offloadEnabled)
        assertFalse(bodyObjectStoreConfigFromEnv(mapOf("TIMES_UP_BODY_OFFLOAD_ENABLED" to "no")).offloadEnabled)
        assertFalse(bodyObjectStoreConfigFromEnv(mapOf("TIMES_UP_BODY_OFFLOAD_ENABLED" to "0")).offloadEnabled)
    }

    @Test
    fun envIntFallsBackOnBadValue() {
        val cfg = bodyObjectStoreConfigFromEnv(mapOf("TIMES_UP_BODY_OFFLOAD_AFTER_DAYS" to "bad"))
        assertEquals(30, cfg.offloadAfterDays)
    }

    @Test
    fun triggerAndPurgeEnvKnobs() {
        val cfg = bodyObjectStoreConfigFromEnv(
            mapOf(
                "TIMES_UP_BODY_OFFLOAD_REQUIRE_PRESSURE" to "true",
                "TIMES_UP_BODY_DB_SIZE_TRIGGER_GB" to "4",
                "TIMES_UP_BODY_BACKUP_MINUTES_TRIGGER" to "20",
                "TIMES_UP_BACKUP_DURATION_MINUTES" to "25",
                "TIMES_UP_BODY_PURGE_ENABLED" to "1",
                "TIMES_UP_BODY_PURGE_AFTER_DAYS" to "180",
            ),
        )
        assertTrue(cfg.requirePressure)
        assertEquals(4L, cfg.dbSizeTriggerGb)
        assertEquals(20L, cfg.backupMinutesTrigger)
        assertEquals(25L, cfg.backupMinutes)
        assertTrue(cfg.purgeEnabled)
        assertEquals(180, cfg.purgeAfterDays)
    }
}
