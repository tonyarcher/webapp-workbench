package fitnessapi.web

import java.time.Clock
import org.springframework.beans.factory.ObjectProvider
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import fitnessapi.LOCAL_USER_ID
import fitnessapi.domain.Point
import fitnessapi.domain.SERIES_LTTB_LIMIT
import fitnessapi.domain.SERIES_ORIGIN_LIMIT
import fitnessapi.domain.downsampleLttb
import fitnessapi.store.SampleStore

@RestController
class SeriesController(
    private val samples: ObjectProvider<SampleStore>,
    private val clock: Clock,
) {
    @GetMapping("/series")
    fun series(
        @RequestParam(required = false) metric: String?,
        @RequestParam(required = false) from: String?,
        @RequestParam(required = false) to: String?,
    ): SeriesJson {
        if (metric.isNullOrEmpty()) throw ApiException(400, "metric required")
        val (start, end) = queryRange(from, to, clock)
        val rows = samples.orOffline().seriesRows(LOCAL_USER_ID, metric, start, end)
        val points = rows.map { Point(it.t, it.valueSi) }
        val origins = rows.takeLast(SERIES_ORIGIN_LIMIT).map { it.toOrigin() }
        return SeriesJson(
            metric = metric,
            points = downsampleLttb(points, SERIES_LTTB_LIMIT).map { it.toJson() },
            n = points.size,
            origins = origins,
        )
    }
}
