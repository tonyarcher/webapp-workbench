package rssapi.poller

import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import org.springframework.beans.factory.DisposableBean
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import rssapi.POLL_BATCH
import rssapi.ingest.IngestService
import rssapi.ingest.IngestSync
import rssapi.log.log
import rssapi.persist.FeedSyncRepo

@Component
class FeedPoller(
    private val ingest: IngestService,
    private val syncRows: FeedSyncRepo,
    private val sync: IngestSync,
) : DisposableBean {
    private val extra = ConcurrentLinkedQueue<UUID>()
    private val inFlight = AtomicBoolean(false)
    private val worker = Executors.newSingleThreadExecutor()
    @Volatile private var stopped = false

    fun queue(ids: List<UUID>) {
        extra.addAll(ids)
        worker.execute { tick() }
    }

    @Scheduled(fixedDelayString = "\${POLL_TICK_MS:60000}")
    fun scheduledTick() {
        tick()
    }

    override fun destroy() {
        stopped = true
        worker.shutdownNow()
    }

    private fun tick() {
        if (stopped || !inFlight.compareAndSet(false, true)) return
        try {
            drain()
        } finally {
            inFlight.set(false)
        }
    }

    private fun drain() {
        do {
            if (stopped) return
            val forced = drainForced()
            val due = dueIds(forced)
            for (id in due.take(POLL_BATCH)) {
                if (stopped) return
                pollOne(id)
            }
        } while (!stopped && extra.isNotEmpty())
    }

    private fun drainForced(): List<UUID> {
        val out = mutableListOf<UUID>()
        while (true) {
            val id = extra.poll() ?: break
            out.add(id)
        }
        return out.distinct()
    }

    private fun dueIds(forced: List<UUID>): List<UUID> {
        val maxAge = System.getenv("POLL_MAX_AGE_MS")?.toLongOrNull() ?: (15 * 60_000L)
        val cutoff = Instant.now().minusMillis(maxAge)
        val need = POLL_BATCH - forced.size
        val extraDue = if (need > 0) {
            syncRows.findDue(cutoff, org.springframework.data.domain.PageRequest.of(0, need)).map { it.feedId }
        } else emptyList()
        return (forced + extraDue).distinct()
    }

    private fun pollOne(id: UUID) {
        try {
            sync.ensureRow(id)
            ingest.pollFeed(id)
        } catch (err: IllegalStateException) {
            logPoll(id, err)
        } catch (err: IllegalArgumentException) {
            logPoll(id, err)
        }
    }

    private fun logPoll(id: UUID, err: Throwable) {
        log(
            "rss-api",
            "error",
            "poller feed",
            mapOf(
                "feed_id" to id.toString(),
                "err" to mapOf("type" to (err::class.simpleName ?: "Error"), "message" to (err.message ?: "")),
            ),
        )
    }
}
