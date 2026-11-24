package timesupapi.feeds
import jakarta.servlet.http.HttpServletRequest
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import timesupapi.ingest.IngestSync
import timesupapi.platform.IdentityUser
import timesupapi.platform.currentRequestIds
import timesupapi.poller.FeedPoller
import java.util.UUID

data class SyncBody(val scope: Any? = null)

data class QueuedBody(val queued: Int)

@RestController
class SyncController(
    private val user: IdentityUser,
    private val subs: SubscriptionRepo,
    private val sync: IngestSync,
    private val poller: FeedPoller,
) {
    @PostMapping("/sync", headers = ["X-Api-Version=1"])
    fun sync(@RequestBody(required = false) body: Map<String, Any?>?, request: HttpServletRequest): QueuedBody {
        val ids = resolveIds(body?.get("scope"))
        ids.forEach { sync.clearFetched(it) }
        poller.queue(ids, currentRequestIds(request))
        return QueuedBody(ids.size)
    }

    private fun resolveIds(scope: Any?): List<UUID> {
        val all = subs.findFeedIdsByUserId(user.id)
        if (scope == null || scope == "all") return all
        if (scope is Map<*, *>) {
            val raw = scope["feedIds"] as? List<*> ?: return emptyList()
            val requested = raw.filterIsInstance<String>().mapNotNull {
                runCatching { UUID.fromString(it) }.getOrNull()
            }
            return all.filter { it in requested }
        }
        return emptyList()
    }
}
