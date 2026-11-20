package rssapi.domain

import kotlin.test.Test
import kotlin.test.assertEquals

class FeedHealthTest {
    private val now = 1_795_082_400_000L

    @Test
    fun healthyFeedIsOk() {
        assertEquals(FeedHealth.OK, FeedHealth.statusOf(null, 0, now - 1_000L, now))
        assertEquals(FeedHealth.OK, FeedHealth.statusOf(null, 0, null, now))
    }

    @Test
    fun oneFailureIsStale() {
        assertEquals(FeedHealth.STALE, FeedHealth.statusOf("down", 1, now, now))
    }

    @Test
    fun repeatedFailuresAreUnreachable() {
        assertEquals(FeedHealth.UNREACHABLE, FeedHealth.statusOf("down", 2, now, now))
        assertEquals(FeedHealth.UNREACHABLE, FeedHealth.statusOf(null, 5, now, now))
    }

    @Test
    fun longSilenceIsStale() {
        val old = now - FeedHealth.STALE_AFTER_MS - 1
        assertEquals(FeedHealth.STALE, FeedHealth.statusOf(null, 0, old, now))
    }

    @Test
    fun freshFeedWinsOverSilence() {
        assertEquals(FeedHealth.OK, FeedHealth.statusOf(null, 0, now - FeedHealth.STALE_AFTER_MS + 1, now))
    }
}
