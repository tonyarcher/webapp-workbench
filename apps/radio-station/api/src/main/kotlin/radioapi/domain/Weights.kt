package radioapi.domain

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
        hitGravity = clampInt(values["hitGravity"], 0, 100, DEFAULT_WEIGHTS.hitGravity),
        goldLeak = clampInt(values["goldLeak"], 0, 100, DEFAULT_WEIGHTS.goldLeak),
        temperature = clampInt(values["temperature"], 0, 100, DEFAULT_WEIGHTS.temperature),
        separation = clampInt(values["separation"], 0, 100, DEFAULT_WEIGHTS.separation),
        powerOrbitMin = clampInt(values["powerOrbitMin"], 60, 150, DEFAULT_WEIGHTS.powerOrbitMin),
    )
}

fun weightsJson(weights: Weights): String =
    "{\"hitGravity\":${weights.hitGravity},\"goldLeak\":${weights.goldLeak}," +
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
