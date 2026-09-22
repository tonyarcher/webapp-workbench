package radioapi.domain

import java.time.Instant
import java.time.ZoneOffset

data class GenerateCommand(
    val stationId: String,
    val seed: String,
    val startsAtMs: Long,
    val weights: Weights,
)

class BadInput(message: String) : RuntimeException(message)

fun parseGenerate(
    stationId: String?,
    seed: String?,
    startsAt: Any?,
    weights: Map<String, Any?>?,
    nextSeed: () -> String = { randomSeed() },
): GenerateCommand {
    val chosenSeed = if (seed.isNullOrBlank()) nextSeed() else normalizeSeed(seed, nextSeed)
    return GenerateCommand(
        stationId = stationId ?: "top40",
        seed = chosenSeed,
        startsAtMs = parseStartsAt(startsAt),
        weights = canonicalizeWeights(weights),
    )
}

fun parseStartsAt(value: Any?): Long {
    if (value == null || value == "") return utcMidnightMs()
    val millis = (value as? Number)?.toDouble() ?: throw BadInput("startsAt must be epoch milliseconds")
    if (!millis.isFinite()) throw BadInput("startsAt must be epoch milliseconds")
    return millis.toLong()
}

fun utcMidnightMs(now: Long = System.currentTimeMillis()): Long {
    val date = Instant.ofEpochMilli(now).atZone(ZoneOffset.UTC)
    return date.toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
}
