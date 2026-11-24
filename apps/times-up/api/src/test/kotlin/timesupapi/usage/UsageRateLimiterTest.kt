package timesupapi.usage
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant

class UsageRateLimiterTest {
    @Test
    fun allowsWithinLimit() {
        val limiter = UsageRateLimiter(maxRequests = 2, windowSeconds = 60)
        val now = Instant.parse("2026-01-01T00:00:00Z")
        assertTrue(limiter.allow("1.2.3.4", now))
        assertTrue(limiter.allow("1.2.3.4", now))
        assertFalse(limiter.allow("1.2.3.4", now))
    }

    @Test
    fun resetsAfterWindow() {
        val limiter = UsageRateLimiter(maxRequests = 1, windowSeconds = 60)
        val now = Instant.parse("2026-01-01T00:00:00Z")
        assertTrue(limiter.allow("1.2.3.4", now))
        assertFalse(limiter.allow("1.2.3.4", now.plusSeconds(30)))
        assertTrue(limiter.allow("1.2.3.4", now.plusSeconds(61)))
    }

    @Test
    fun isolatesKeys() {
        val limiter = UsageRateLimiter(maxRequests = 1, windowSeconds = 60)
        val now = Instant.parse("2026-01-01T00:00:00Z")
        assertTrue(limiter.allow("a", now))
        assertTrue(limiter.allow("b", now))
    }
}
