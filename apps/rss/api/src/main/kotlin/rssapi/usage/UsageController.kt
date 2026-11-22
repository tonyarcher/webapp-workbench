package rssapi.usage
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.feeds.OkBody
import rssapi.platform.ApiException
import java.time.LocalDate
import java.time.ZoneOffset

internal val USAGE_FEATURES: Set<String> = setOf(
    "tab_opened",
    "body_loaded",
    "board_opened",
    "older_article_opened",
    "digest_read",
    "settings_panel_viewed",
)

internal const val USAGE_MAX_EVENTS: Int = 50
internal const val USAGE_MAX_COUNT: Long = 1000

data class UsageEventBody(val feature: String? = null, val count: Long? = null)
data class UsageBatchBody(val events: List<UsageEventBody>? = null)

@RestController
class UsageController(
    private val usageEnabled: UsageEnabled,
    private val repo: FeatureUsageRepo,
    private val rateLimiter: UsageRateLimiter,
) {
    @PostMapping("/usage", headers = ["X-Api-Version=1"])
    fun record(@RequestBody body: UsageBatchBody, request: HttpServletRequest): OkBody {
        if (!usageEnabled.value) throw ApiException(HttpStatus.NOT_FOUND, "Not found")
        if (!rateLimiter.allow(request.remoteAddr ?: "unknown")) {
            throw ApiException(HttpStatus.TOO_MANY_REQUESTS, "too many requests")
        }
        val events = validatedEvents(body)
        if (events.isEmpty()) return OkBody()
        val day = LocalDate.now(ZoneOffset.UTC)
        for ((feature, count) in aggregate(events)) {
            repo.increment(feature, day, count)
        }
        return OkBody()
    }

    private fun validatedEvents(body: UsageBatchBody): List<UsageEventBody> {
        val events = body.events ?: badRequest("events array is required")
        if (events.size > USAGE_MAX_EVENTS) badRequest("too many events")
        return events
    }

    private fun aggregate(events: List<UsageEventBody>): Map<String, Long> {
        val totals = LinkedHashMap<String, Long>()
        for (event in events) {
            val feature = parseFeature(event.feature)
            val count = parseCount(event.count)
            totals[feature] = (totals[feature] ?: 0L) + count
        }
        return totals
    }

    private fun parseFeature(raw: String?): String =
        raw?.trim()?.takeIf { it in USAGE_FEATURES } ?: badRequest("invalid feature")

    private fun parseCount(count: Long?): Long {
        val value = count ?: badRequest("count is required")
        if (value < 1 || value > USAGE_MAX_COUNT) badRequest("invalid count")
        return value
    }

    private fun badRequest(message: String): Nothing = throw ApiException(HttpStatus.BAD_REQUEST, message)
}
