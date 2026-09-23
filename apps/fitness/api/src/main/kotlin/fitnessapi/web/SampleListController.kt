package fitnessapi.web

import fitnessapi.LOCAL_USER_ID
import fitnessapi.store.SampleStore
import org.springframework.beans.factory.ObjectProvider
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Clock

@RestController
class SampleListController(private val samples: ObjectProvider<SampleStore>, private val clock: Clock) {
    @GetMapping("/stats", headers = ["X-Api-Version=1"])
    fun stats(): StatsJson = StatsJson(samples.orOffline().stats(LOCAL_USER_ID).map { it.toJson() })

    @GetMapping("/samples/latest", headers = ["X-Api-Version=1"])
    fun latest(): LatestJson = LatestJson(samples.orOffline().latest(LOCAL_USER_ID).map { it.toJson() })

    @GetMapping("/samples", headers = ["X-Api-Version=1"])
    fun list(
        @RequestParam(required = false) metric: String?,
        @RequestParam(required = false) from: String?,
        @RequestParam(required = false) to: String?,
        @RequestParam(required = false) limit: String?,
    ): SamplesJson {
        val store = samples.orOffline()
        val (start, end) = queryRange(from, to, clock)
        val rows = store.listSamples(LOCAL_USER_ID, metric, start, end, limitParam(limit))
        return SamplesJson(rows.map { it.toJson() })
    }

    @GetMapping("/rollups", headers = ["X-Api-Version=1"])
    fun rollups(): RollupsJson = RollupsJson(samples.orOffline().rollups(LOCAL_USER_ID).map { it.toJson() })
}
