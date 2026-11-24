package timesupapi.usage
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

internal const val USAGE_RATE_LIMIT_MAX: Int = 30
internal const val USAGE_RATE_LIMIT_MAX_KEYS: Int = 10_000
internal const val USAGE_RATE_LIMIT_WINDOW_SECONDS: Long = 600
private const val PRUNE_EVERY: Int = 1_024

private data class Window(var startEpochSec: Long, val count: AtomicInteger)

@Component
class UsageRateLimiter(
    private val maxRequests: Int = USAGE_RATE_LIMIT_MAX,
    private val windowSeconds: Long = USAGE_RATE_LIMIT_WINDOW_SECONDS,
    private val maxKeys: Int = USAGE_RATE_LIMIT_MAX_KEYS,
) {
    private val windows = ConcurrentHashMap<String, Window>()
    private val calls = AtomicLong()

    fun allow(key: String, now: Instant = Instant.now()): Boolean {
        val epochSec = now.epochSecond
        if (windows.size + 1 >= maxKeys || calls.incrementAndGet() % PRUNE_EVERY == 0L) pruneExpired(epochSec)
        if (windows.size >= maxKeys) {
            windows.entries.minByOrNull { it.value.startEpochSec }?.let { oldest ->
                windows.remove(oldest.key, oldest.value)
            }
        }
        val window = windows.compute(key) { _, existing ->
            val current = existing ?: Window(epochSec, AtomicInteger(0))
            if (epochSec - current.startEpochSec >= windowSeconds) {
                current.startEpochSec = epochSec
                current.count.set(0)
            }
            current
        }!!
        return window.count.incrementAndGet() <= maxRequests
    }

    internal fun trackedKeys(): Int = windows.size

    private fun pruneExpired(epochSec: Long) {
        windows.entries.removeIf { epochSec - it.value.startEpochSec >= windowSeconds }
    }
}
