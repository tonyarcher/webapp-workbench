package timesupapi.poller
import org.springframework.beans.factory.DisposableBean
import org.springframework.dao.DataAccessException
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import timesupapi.feeds.FeedSyncEntity
import timesupapi.feeds.FeedSyncRepo
import timesupapi.ingest.FeedBackoff
import timesupapi.ingest.IngestService
import timesupapi.ingest.IngestSync
import timesupapi.platform.POLL_BATCH
import timesupapi.platform.RequestIds
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean

@Component
class FeedPoller(
    private val ingest: IngestService,
    private val syncRows: FeedSyncRepo,
    private val sync: IngestSync,
    private val backoff: FeedBackoff,
) : DisposableBean {
    private val logger = PollerLog()
    private val extra = ConcurrentHashMap.newKeySet<UUID>()
    private val traces = ConcurrentHashMap<UUID, RequestIds>()
    private val inFlight = AtomicBoolean(false)
    private val workerQueued = AtomicBoolean(false)
    private val worker = Executors.newSingleThreadExecutor()

    @Volatile private var stopped = false

    fun queue(ids: List<UUID>, trace: RequestIds? = null) {
        if (stopped) return
        ids.distinct().forEach { id ->
            extra.add(id)
            if (trace != null) traces.putIfAbsent(id, trace)
        }
        scheduleWorker()
    }

    @Scheduled(fixedDelayString = "\${POLL_TICK_MS:60000}")
    fun scheduledTick() {
        tick()
    }

    override fun destroy() {
        stopped = true
        extra.clear()
        traces.clear()
        worker.shutdownNow()
    }

    private fun scheduleWorker() {
        if (stopped || !workerQueued.compareAndSet(false, true)) return
        try {
            worker.execute(::runWorker)
        } catch (_: RejectedExecutionException) {
            workerQueued.set(false)
        }
    }

    private fun runWorker() {
        try {
            tick()
        } finally {
            workerQueued.set(false)
            if (!stopped && extra.isNotEmpty()) scheduleWorker()
        }
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
            forced.forEach { backoff.clear(it.feedId) }
            val due = dueIds(forced)
            for (item in due.take(POLL_BATCH)) {
                if (stopped) return
                pollOne(item.feedId, item.trace)
            }
        } while (!stopped && extra.isNotEmpty())
    }

    private fun drainForced(): List<DueFeed> {
        val out = mutableListOf<DueFeed>()
        repeat(POLL_BATCH) {
            val id = extra.firstOrNull() ?: return out
            extra.remove(id)
            out.add(DueFeed(id, traces.remove(id)))
        }
        return out
    }

    private fun dueIds(forced: List<DueFeed>): List<DueFeed> {
        val maxAge = System.getenv("POLL_MAX_AGE_MS")?.toLongOrNull() ?: (15 * 60_000L)
        val now = Instant.now()
        val cutoff = now.minusMillis(maxAge)
        val need = POLL_BATCH - forced.size
        if (need <= 0) return forced
        val candidates = syncRows.findDue(cutoff, now, PageRequest.of(0, need))
        val extraDue = candidates.map { DueFeed(it.feedId, null) }
        return (forced + extraDue).distinctBy { it.feedId }
    }

    private fun pollOne(id: UUID, trace: RequestIds?) {
        try {
            sync.ensureRow(id)
            ingest.fetchAndIngest(id)
        } catch (err: IllegalStateException) {
            logger.feedFailure(id, err, trace)
        } catch (err: IllegalArgumentException) {
            logger.feedFailure(id, err, trace)
        } catch (err: DataAccessException) {
            // One poison feed must never abort the drain and starve every feed behind it.
            logger.feedFailure(id, err, trace)
        }
    }

    private data class DueFeed(val feedId: UUID, val trace: RequestIds?)
}
