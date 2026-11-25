package timesupapi.interests

import org.springframework.stereotype.Service
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.concurrent.atomic.AtomicBoolean

@Service
class ResolutionJob(private val resolver: ResolutionService, private val cache: ResolutionCacheRepo) {
    internal var clock: Clock = Clock.systemUTC()
    private val running = AtomicBoolean(false)
    private val stopped = AtomicBoolean(false)
    private val minDelayMs = 200L
    private val batchSize = 10
    private var nextRun: Instant = Instant.now()

    fun isRunning(): Boolean = running.get() && !stopped.get()

    fun tick(labels: List<String>): Int {
        if (stopped.get()) return 0
        if (!running.compareAndSet(false, true)) return 0
        try {
            val now = clock.instant()
            if (now.isBefore(nextRun)) return 0
            var processed = 0
            for (label in labels.take(batchSize)) {
                val key = label.trim().lowercase()
                if (key.isNotEmpty() && cache.findByLabelKey(key) == null) {
                    resolver.resolve(label)
                    processed++
                    Thread.sleep(minDelayMs)
                }
            }
            nextRun = clock.instant().plus(Duration.ofMillis(minDelayMs * batchSize))
            return processed
        } finally {
            running.set(false)
        }
    }

    fun start() {
        stopped.set(false)
    }
    fun stop() {
        stopped.set(true)
    }
}
