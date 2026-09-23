package fitnessapi.web

import fitnessapi.domain.clampLimit
import fitnessapi.domain.queryMillis
import java.time.Clock

fun queryRange(fromRaw: String?, toRaw: String?, clock: Clock): Pair<Long, Long> {
    val from = queryMillis(fromRaw?.toDoubleOrNull(), 0L)
    val to = queryMillis(toRaw?.toDoubleOrNull(), clock.millis())
    return from to to
}

fun limitParam(raw: String?): Int = clampLimit(raw?.toDoubleOrNull())
