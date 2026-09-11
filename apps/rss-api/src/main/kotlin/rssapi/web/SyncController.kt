package rssapi.web

import java.util.UUID
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import rssapi.ingest.IngestSync
import rssapi.persist.FeedRepo
import rssapi.poller.FeedPoller

data class SyncBody(val scope: Any? = null)

data class QueuedBody(val queued: Int)

@RestController
class SyncController(
    private val user: CookieUser,
    private val feeds: FeedRepo,
    private val sync: IngestSync,
    private val poller: FeedPoller,
) {
    @PostMapping("/sync")
    fun sync(@RequestBody(required = false) body: Map<String, Any?>?): QueuedBody {
        val ids = resolveIds(body?.get("scope"))
        ids.forEach { sync.clearFetched(it) }
        poller.queue(ids)
        return QueuedBody(ids.size)
    }

    private fun resolveIds(scope: Any?): List<UUID> {
        val all = feeds.findByUserIdOrderByAddedAtAsc(user.id).mapNotNull { it.id }
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
