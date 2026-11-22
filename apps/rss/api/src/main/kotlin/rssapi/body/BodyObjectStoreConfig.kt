package rssapi.body

private const val DEFAULT_OFFLOAD_AFTER_DAYS = 30

/** S3/object-store knobs. Empty bucket disables the cold tier. */
data class BodyObjectStoreConfig(
    val endpoint: String = "",
    val region: String = "us-east-1",
    val bucket: String = "",
    val prefix: String = "rss/bodies",
    val accessKey: String = "",
    val secretKey: String = "",
    val offloadEnabled: Boolean = false,
    val offloadAfterDays: Int = DEFAULT_OFFLOAD_AFTER_DAYS,
) {
    fun enabled(): Boolean = bucket.isNotBlank()

    override fun toString(): String =
        "BodyObjectStoreConfig(endpoint=$endpoint, region=$region, bucket=$bucket, prefix=$prefix, offload=$offloadEnabled)"
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
    )

private fun envText(env: Map<String, String>, key: String, default: String = ""): String = (env[key] ?: default).trim()

private fun envInt(env: Map<String, String>, key: String, default: Int): Int =
    env[key]?.trim()?.toIntOrNull() ?: default

private fun envBool(env: Map<String, String>, key: String, default: Boolean): Boolean {
    val raw = env[key]?.trim()?.lowercase() ?: return default
    return raw == "1" || raw == "true" || raw == "yes"
}
