package rssapi.usage
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

internal const val USAGE_RATE_LIMIT_MAX: Int = 30
internal const val USAGE_RATE_LIMIT_WINDOW_SECONDS: Long = 600

private data class Window(var startEpochSec: Long, val count: AtomicInteger)

@Component
class UsageRateLimiter(
    private val maxRequests: Int = USAGE_RATE_LIMIT_MAX,
    private val windowSeconds: Long = USAGE_RATE_LIMIT_WINDOW_SECONDS,
) {
    private val windows = ConcurrentHashMap<String, Window>()

    fun allow(key: String, now: Instant = Instant.now()): Boolean {
        val epochSec = now.epochSecond
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
}
