package rssapi.ai

/** Defaults for every AI knob; each is overridable by its AI_* env var. */
private const val DEFAULT_TIMEOUT_MS = 90_000L
private const val DEFAULT_PROBE_TIMEOUT_MS = 5_000L
private const val DEFAULT_HOURLY_LIMIT = 30
private const val DEFAULT_DAILY_LIMIT = 100
private const val DEFAULT_MAX_INPUT_CHARS = 8_000

/**
 * Server AI knobs. The provider is an admin server setting: empty means off
 * and the reader hides every server option. Model credentials never live
 * here; basic-auth pairs for the model host stay in the untracked .env.
 * The TypeSafe key (TYPESAFE_API_KEY) likewise stays out of git and out of
 * toString(); only presence is ever checked in code.
 */
data class AiConfig(
    val provider: String = "",
    val baseUrl: String = "",
    val model: String = "",
    val timeoutMs: Long = DEFAULT_TIMEOUT_MS,
    val probeTimeoutMs: Long = DEFAULT_PROBE_TIMEOUT_MS,
    val hourlyLimit: Int = DEFAULT_HOURLY_LIMIT,
    val dailyLimit: Int = DEFAULT_DAILY_LIMIT,
    val maxInputChars: Int = DEFAULT_MAX_INPUT_CHARS,
    val basicUser: String = "",
    val basicPassword: String = "",
    val jevApiKey: String = "",
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
        timeoutMs = envLong(env, "AI_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
        probeTimeoutMs = envLong(env, "AI_PROBE_TIMEOUT_MS", DEFAULT_PROBE_TIMEOUT_MS),
        hourlyLimit = envInt(env, "AI_HOURLY_LIMIT", DEFAULT_HOURLY_LIMIT),
        dailyLimit = envInt(env, "AI_DAILY_LIMIT", DEFAULT_DAILY_LIMIT),
        maxInputChars = envInt(env, "AI_MAX_INPUT_CHARS", DEFAULT_MAX_INPUT_CHARS),
        basicUser = env["AI_API_USER"] ?: "",
        basicPassword = env["AI_API_PASSWORD"] ?: "",
        jevApiKey = envText(env, "TYPESAFE_API_KEY"),
    )
}

private fun envText(env: Map<String, String>, key: String): String = (env[key] ?: "").trim()

private fun envLong(env: Map<String, String>, key: String, default: Long): Long = env[key]?.toLongOrNull() ?: default

private fun envInt(env: Map<String, String>, key: String, default: Int): Int = env[key]?.toIntOrNull() ?: default
