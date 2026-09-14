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
    val provider = (env["AI_PROVIDER"] ?: "").trim().lowercase()
    return AiConfig(
        provider = provider,
        baseUrl = (env["AI_API_URL"] ?: "").trim().trimEnd('/'),
        model = (env["AI_MODEL"] ?: "").trim(),
        timeoutMs = env["AI_TIMEOUT_MS"]?.toLongOrNull() ?: 90_000L,
        probeTimeoutMs = env["AI_PROBE_TIMEOUT_MS"]?.toLongOrNull() ?: 5_000L,
        hourlyLimit = env["AI_HOURLY_LIMIT"]?.toIntOrNull() ?: 30,
        dailyLimit = env["AI_DAILY_LIMIT"]?.toIntOrNull() ?: 100,
        maxInputChars = env["AI_MAX_INPUT_CHARS"]?.toIntOrNull() ?: 8_000,
        basicUser = env["AI_API_USER"] ?: "",
        basicPassword = env["AI_API_PASSWORD"] ?: "",
    )
}
