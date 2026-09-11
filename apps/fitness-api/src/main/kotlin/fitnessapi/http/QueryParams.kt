package fitnessapi.http

import io.ktor.server.application.ApplicationCall
import java.time.Clock
import fitnessapi.domain.clampLimit
import fitnessapi.domain.queryMillis

fun ApplicationCall.timeRange(clock: Clock): Pair<Long, Long> {
    val from = queryMillis(request.queryParameters["from"]?.toDoubleOrNull(), 0L)
    val to = queryMillis(request.queryParameters["to"]?.toDoubleOrNull(), clock.millis())
    return from to to
}

fun ApplicationCall.limitParam(): Int =
    clampLimit(request.queryParameters["limit"]?.toDoubleOrNull())
