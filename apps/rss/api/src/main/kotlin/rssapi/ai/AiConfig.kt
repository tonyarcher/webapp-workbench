package rssapi.ai

/**
 * Server AI knobs. The provider is an admin server setting: empty means off
 * and the reader hides every server option. Model credentials never live
 * here; basic-auth pairs for the model host stay in the untracked .env.
 */
data class AiConfig(
    val provider: String = "",
    val baseUrl: String = "",
    val model: String = "",
    val timeoutMs: Long = 90_000L,
    val probeTimeoutMs: Long = 5_000L,
    val hourlyLimit: Int = 30,
    val dailyLimit: Int = 100,
    val maxInputChars: Int = 8_000,
    val basicUser: String = "",
    val basicPassword: String = "",
) {
    override fun toString(): String =
        "AiConfig(provider=$provider, baseUrl=$baseUrl, model=$model, timeoutMs=$timeoutMs)"
}

fun aiConfigFromEnv(env: Map<String, String> = System.getenv()): AiConfig {
    val provider = envText(env, "AI_PROVIDER").lowercase()
    return AiConfig(
        provider = provider,
        baseUrl = envText(env, "AI_API_URL").trimEnd('/'),
        model = envText(env, "AI_MODEL"),
        timeoutMs = envLong(env, "AI_TIMEOUT_MS", 90_000L),
        probeTimeoutMs = envLong(env, "AI_PROBE_TIMEOUT_MS", 5_000L),
        hourlyLimit = envInt(env, "AI_HOURLY_LIMIT", 30),
        dailyLimit = envInt(env, "AI_DAILY_LIMIT", 100),
        maxInputChars = envInt(env, "AI_MAX_INPUT_CHARS", 8_000),
        basicUser = env["AI_API_USER"] ?: "",
        basicPassword = env["AI_API_PASSWORD"] ?: "",
    )
}

private fun envText(env: Map<String, String>, key: String): String = (env[key] ?: "").trim()

private fun envLong(env: Map<String, String>, key: String, default: Long): Long =
    env[key]?.toLongOrNull() ?: default

private fun envInt(env: Map<String, String>, key: String, default: Int): Int =
    env[key]?.toIntOrNull() ?: default
