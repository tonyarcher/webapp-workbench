package userapi.persist

import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional
import userapi.http.RateLimitCounter
import java.time.Instant
import java.util.concurrent.atomic.AtomicLong

/**
 * Postgres-backed attempt counter, so every replica shares one budget.
 *
 * The increment and the window reset are one statement because a read-then-write
 * would let two replicas both read the same count and each allow a request.
 */
@Repository
class JpaRateLimitStore(private val repo: RateLimitRepo) : RateLimitCounter {
    private val hitsSinceTrim = AtomicLong()

    @Transactional
    override fun recordHit(key: String, now: Instant, windowMs: Long): Int {
        trimOccasionally(now)
        return repo.recordHit(key, now, now.minusMillis(windowMs))
    }

    /**
     * Closed windows are dead weight and nothing else prunes them: a key nobody
     * retries keeps its row forever, which is how the in-memory map this replaced
     * grew without bound. Amortised over a fixed number of hits instead of run on
     * a timer, so the table stays bounded without adding a scheduler. Purely an
     * optimisation; the threshold never depends on it.
     */
    private fun trimOccasionally(now: Instant) {
        if (hitsSinceTrim.incrementAndGet() % HITS_PER_TRIM != 0L) return
        repo.trimStaleWindows(now.minusMillis(TRIM_AFTER_MS))
    }

    private companion object {
        const val HITS_PER_TRIM = 1_000L
        const val TRIM_AFTER_MS = 24 * 60 * 60 * 1000L
    }
}
