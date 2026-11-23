package rssapi.storage
private const val DEFAULT_OFFLOAD_AFTER_DAYS = 30
private const val DEFAULT_DB_SIZE_TRIGGER_GB = 2L
private const val DEFAULT_BACKUP_MINUTES_TRIGGER = 15L
private const val DEFAULT_PURGE_AFTER_DAYS = 365
private const val DEFAULT_EXCERPT_HEAD_CHARS = 800

/** S3/object-store knobs. Empty bucket disables every object-store tier. */
data class BodyObjectStoreConfig(
    val endpoint: String = "",
    val region: String = "us-east-1",
    val bucket: String = "",
    val prefix: String = "rss/bodies",
    val accessKey: String = "",
    val secretKey: String = "",
    val offloadEnabled: Boolean = false,
    val offloadAfterDays: Int = DEFAULT_OFFLOAD_AFTER_DAYS,
    /** Where full excerpts go. Separate from bodies so a purge can differ. */
    val excerptPrefix: String = "rss/excerpts",
    val excerptOffloadEnabled: Boolean = false,
    /** Characters of the excerpt kept in Postgres for search and list previews. */
    val excerptHeadChars: Int = DEFAULT_EXCERPT_HEAD_CHARS,
    /** When true, offload waits for the DB-size or backup-duration trigger. */
    val requirePressure: Boolean = false,
    val dbSizeTriggerGb: Long = DEFAULT_DB_SIZE_TRIGGER_GB,
    val backupMinutesTrigger: Long = DEFAULT_BACKUP_MINUTES_TRIGGER,
    /** Last full-backup duration in minutes, supplied by the backup job. */
    val backupMinutes: Long = 0,
    val purgeEnabled: Boolean = false,
    val purgeAfterDays: Int = DEFAULT_PURGE_AFTER_DAYS,
) {
    fun enabled(): Boolean = bucket.isNotBlank()

    override fun toString(): String =
        "BodyObjectStoreConfig(endpoint=$endpoint, region=$region, bucket=$bucket, prefix=$prefix, " +
            "offload=$offloadEnabled, afterDays=$offloadAfterDays, excerptOffload=$excerptOffloadEnabled, " +
            "requirePressure=$requirePressure, purge=$purgeEnabled)"
}

fun bodyObjectStoreConfigFromEnv(env: Map<String, String> = System.getenv()): BodyObjectStoreConfig =
    BodyObjectStoreConfig(
        endpoint = envText(env, "RSS_BODY_S3_ENDPOINT", envText(env, "S3_ENDPOINT", "")),
        region = envText(env, "RSS_BODY_S3_REGION", envText(env, "S3_REGION", "us-east-1")),
        bucket = envText(env, "RSS_BODY_S3_BUCKET", ""),
        prefix = envText(env, "RSS_BODY_S3_PREFIX", "rss/bodies").trim('/'),
        accessKey = envText(env, "RSS_BODY_S3_ACCESS_KEY", envText(env, "S3_ACCESS_KEY", "")),
        secretKey = envText(env, "RSS_BODY_S3_SECRET_KEY", envText(env, "S3_SECRET_KEY", "")),
        offloadEnabled = envBool(env, "RSS_BODY_OFFLOAD_ENABLED", false),
        offloadAfterDays = envInt(env, "RSS_BODY_OFFLOAD_AFTER_DAYS", DEFAULT_OFFLOAD_AFTER_DAYS),
        excerptPrefix = envText(env, "RSS_EXCERPT_S3_PREFIX", "rss/excerpts").trim('/'),
        excerptOffloadEnabled = envBool(env, "RSS_EXCERPT_OFFLOAD_ENABLED", false),
        excerptHeadChars = envInt(env, "RSS_EXCERPT_HEAD_CHARS", DEFAULT_EXCERPT_HEAD_CHARS).coerceAtLeast(0),
        requirePressure = envBool(env, "RSS_BODY_OFFLOAD_REQUIRE_PRESSURE", false),
        dbSizeTriggerGb = envLong(env, "RSS_BODY_DB_SIZE_TRIGGER_GB", DEFAULT_DB_SIZE_TRIGGER_GB),
        backupMinutesTrigger = envLong(env, "RSS_BODY_BACKUP_MINUTES_TRIGGER", DEFAULT_BACKUP_MINUTES_TRIGGER),
        backupMinutes = envLong(env, "RSS_BACKUP_DURATION_MINUTES", 0),
        purgeEnabled = envBool(env, "RSS_BODY_PURGE_ENABLED", false),
        purgeAfterDays = envInt(env, "RSS_BODY_PURGE_AFTER_DAYS", DEFAULT_PURGE_AFTER_DAYS),
    )

private fun envText(env: Map<String, String>, key: String, default: String = ""): String = (env[key] ?: default).trim()

private fun envInt(env: Map<String, String>, key: String, default: Int): Int =
    env[key]?.trim()?.toIntOrNull() ?: default

private fun envLong(env: Map<String, String>, key: String, default: Long): Long =
    env[key]?.trim()?.toLongOrNull() ?: default

private fun envBool(env: Map<String, String>, key: String, default: Boolean): Boolean {
    val raw = env[key]?.trim()?.lowercase() ?: return default
    return raw == "1" || raw == "true" || raw == "yes"
}
