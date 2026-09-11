package fitnessapi.http

import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import fitnessapi.LOCAL_USER_ID
import fitnessapi.domain.Point
import fitnessapi.domain.SERIES_LTTB_LIMIT
import fitnessapi.domain.SERIES_ORIGIN_LIMIT
import fitnessapi.domain.downsampleLttb
import fitnessapi.store.FitnessServices

internal suspend fun getSeries(call: ApplicationCall, fitness: FitnessServices) {
    val store = call.requireSamples(fitness) ?: return
    val metric = call.request.queryParameters["metric"]
    if (metric.isNullOrEmpty()) throw ApiError(400, "metric required")
    val (from, to) = call.timeRange(fitness.clock)
    val rows = store.seriesRows(LOCAL_USER_ID, metric, from, to)
    val points = rows.map { Point(it.t, it.valueSi) }
    val origins = rows.takeLast(SERIES_ORIGIN_LIMIT).map { it.toOrigin() }
    call.respond(
        SeriesJson(
            metric = metric,
            points = downsampleLttb(points, SERIES_LTTB_LIMIT).map { it.toJson() },
            n = points.size,
            origins = origins,
        ),
    )
}
