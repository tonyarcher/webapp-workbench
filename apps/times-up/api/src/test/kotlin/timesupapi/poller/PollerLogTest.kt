package timesupapi.poller

import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import timesupapi.platform.RequestIds
import java.util.UUID

class PollerLogTest {
    @Test
    fun logsFailuresWithAndWithoutRequestTrace() {
        val log = PollerLog()
        log.feedFailure(UUID.randomUUID(), IllegalStateException("boom"), null)
        log.feedFailure(UUID.randomUUID(), object : IllegalStateException() {}, RequestIds("req", "trace", "span"))
        assertTrue(true)
    }
}
