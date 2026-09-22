package radioapi.domain

private val ADJECTIVES = listOf(
    "amber", "velvet", "neon", "chrome", "midnight", "summer", "glass", "silver",
    "golden", "static", "lunar", "pulse", "signal", "ivory", "copper", "violet",
    "autumn", "sonic", "bright", "quiet",
)

private val NOUNS = listOf(
    "orbit", "boulevard", "frequency", "skyline", "chorus", "voltage", "afterglow",
    "oak", "signal", "harbor", "echo", "antenna", "marquee", "circuit", "horizon",
    "stereo", "dial", "ribbon", "canyon", "spark",
)

fun randomSeed(roll: () -> Int = { kotlin.random.Random.nextInt(ADJECTIVES.size) }): String {
    val adjective = ADJECTIVES[roll() % ADJECTIVES.size]
    val noun = NOUNS[roll() % NOUNS.size]
    return "$adjective-$noun"
}

fun normalizeSeed(raw: String, fallback: () -> String = { randomSeed() }): String {
    val trimmed = raw.trim().lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')
    return trimmed.ifEmpty { fallback() }
}
