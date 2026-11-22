package rssapi.storage
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class BodyReadThroughTest {
    private class FakeStore : BodyStore {
        var body: String? = null
        var failRead = false
        var failWrite = false
        var writes = 0

        override fun get(articleId: String): String? {
            if (failRead) throw IllegalStateException("read failed")
            return body
        }

        override fun put(articleId: String, html: String) {
            writes++
            if (failWrite) throw IllegalStateException("write failed")
            body = html
        }
    }

    @Test
    fun cacheHitSkipsFetch() {
        val store = FakeStore().apply { body = "cached" }
        var fetches = 0

        val result = BodyReadThrough(store).load("a") {
            fetches++
            "fetched"
        }

        assertEquals("cached", result.html)
        assertTrue(result.fromStore)
        assertEquals(0, fetches)
        assertEquals(0, store.writes)
    }

    @Test
    fun missFetchesAndCaches() {
        val store = FakeStore()

        val result = BodyReadThrough(store).load("a") { "fetched" }

        assertEquals("fetched", result.html)
        assertFalse(result.fromStore)
        assertEquals("fetched", store.body)
        assertEquals(1, store.writes)
    }

    @Test
    fun blankCacheIsAMiss() {
        val store = FakeStore().apply { body = "  " }

        val result = BodyReadThrough(store).load("a") { "fetched" }

        assertEquals("fetched", result.html)
        assertFalse(result.fromStore)
    }

    @Test
    fun storeReadFailureBecomesMiss() {
        val store = FakeStore().apply { failRead = true }

        val result = BodyReadThrough(store).load("a") { "fetched" }

        assertEquals("fetched", result.html)
        assertFalse(result.fromStore)
    }

    @Test
    fun storeWriteFailureStillReturnsBody() {
        val store = FakeStore().apply { failWrite = true }

        val result = BodyReadThrough(store).load("a") { "fetched" }

        assertEquals("fetched", result.html)
        assertFalse(result.fromStore)
    }

    @Test
    fun fetchFailureReturnsNoBody() {
        val store = FakeStore()

        val result = BodyReadThrough(store).load("a") { throw IllegalStateException("fetch failed") }

        assertNull(result.html)
        assertFalse(result.fromStore)
        assertEquals(0, store.writes)
    }

    @Test
    fun blankFetchIsNotCached() {
        val store = FakeStore()

        val result = BodyReadThrough(store).load("a") { "" }

        assertNull(result.html)
        assertEquals(0, store.writes)
    }
}
