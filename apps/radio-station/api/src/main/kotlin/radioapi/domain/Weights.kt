package radioapi.domain

/** Sliders run 0..100; the orbit slider is minutes and has its own range. */
private const val PERCENT_MIN = 0
private const val PERCENT_MAX = 100
private const val POWER_ORBIT_MIN_MINUTES = 60
private const val POWER_ORBIT_MAX_MINUTES = 150

val DEFAULT_WEIGHTS: Weights = Weights(
    hitGravity = 70,
    goldLeak = 15,
    temperature = 40,
    separation = 60,
    powerOrbitMin = 90,
)

fun canonicalizeWeights(raw: Map<String, Any?>?): Weights {
    val values = raw ?: emptyMap()
    return Weights(
        hitGravity = clampInt(values["hitGravity"], PERCENT_MIN, PERCENT_MAX, DEFAULT_WEIGHTS.hitGravity),
        goldLeak = clampInt(values["goldLeak"], PERCENT_MIN, PERCENT_MAX, DEFAULT_WEIGHTS.goldLeak),
        temperature = clampInt(values["temperature"], PERCENT_MIN, PERCENT_MAX, DEFAULT_WEIGHTS.temperature),
        separation = clampInt(values["separation"], PERCENT_MIN, PERCENT_MAX, DEFAULT_WEIGHTS.separation),
        powerOrbitMin = clampInt(
            values["powerOrbitMin"],
            POWER_ORBIT_MIN_MINUTES,
            POWER_ORBIT_MAX_MINUTES,
            DEFAULT_WEIGHTS.powerOrbitMin,
        ),
    )
}

fun weightsJson(weights: Weights): String = "{\"hitGravity\":${weights.hitGravity},\"goldLeak\":${weights.goldLeak}," +
    "\"temperature\":${weights.temperature},\"separation\":${weights.separation}," +
    "\"powerOrbitMin\":${weights.powerOrbitMin}}"

private fun clampInt(value: Any?, min: Int, max: Int, fallback: Int): Int {
    val number = when (value) {
        is Number -> value.toDouble()
        is String -> value.toDoubleOrNull()
        else -> null
    } ?: return fallback
    if (!number.isFinite()) return fallback
    return kotlin.math.round(number).toInt().coerceIn(min, max)
}
