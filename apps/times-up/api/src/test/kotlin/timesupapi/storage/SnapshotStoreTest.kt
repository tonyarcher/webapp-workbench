package timesupapi.storage

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.UUID

class SnapshotStoreTest {
    private val client: BodyObjectClient = mock()
    private val owner = UUID.randomUUID()

    @Test
    fun disabledStoreKeepsHtmlInDatabase() {
        val store = SnapshotStore(client, BodyObjectStoreConfig())
        assertNull(store.put("saved", owner, "a1", "<p>x</p>"))
        verify(client, never()).put(any(), any())
    }

    @Test
    fun blankBodyIsNotStored() {
        val store = SnapshotStore(client, BodyObjectStoreConfig(bucket = "b"))
        assertNull(store.put("saved", owner, "a1", "  "))
        verify(client, never()).put(any(), any())
    }

    @Test
    fun disabledStoreFallsBackToLegacyHtml() {
        val store = SnapshotStore(client, BodyObjectStoreConfig())
        assertEquals("<p>legacy</p>", store.load("key", "<p>legacy</p>"))
        verify(client, never()).get(any())
    }

    @Test
    fun enabledStoreWritesCompressedObject() {
        val store = SnapshotStore(client, BodyObjectStoreConfig(bucket = "b"))
        val key = store.put("board", owner, "a1", "<p>x</p>")
        assertTrue(key!!.contains("/board/$owner/"))
        assertTrue(key.endsWith(".html.gz"))
        verify(client).put(org.mockito.kotlin.eq(key), any())
    }

    @Test
    fun loadPrefersObjectStoreThenLegacyHtml() {
        val store = SnapshotStore(client, BodyObjectStoreConfig(bucket = "b"))
        whenever(client.get("key")).thenReturn(ObjectText.encode("<p>stored</p>"))
        assertEquals("<p>stored</p>", store.load("key", "<p>legacy</p>"))
        whenever(client.get("missing")).thenReturn(null)
        assertEquals("<p>legacy</p>", store.load("missing", "<p>legacy</p>"))
        assertNull(store.load("missing", "  "))
    }

    @Test
    fun prefixCanBeBlank() {
        val store = SnapshotStore(client, BodyObjectStoreConfig(bucket = "b", snapshotPrefix = ""))
        val key = store.put("saved", owner, "a1", "<p>x</p>")
        assertTrue(key!!.startsWith("saved/$owner/"))
    }

    @Test
    fun blankStoredObjectFallsBackToLegacyHtml() {
        val store = SnapshotStore(client, BodyObjectStoreConfig(bucket = "b"))
        whenever(client.get("key")).thenReturn(" ".toByteArray())
        assertEquals("<p>legacy</p>", store.load("key", "<p>legacy</p>"))
    }

    @Test
    fun putFailureFallsBackToLegacyHtml() {
        val store = SnapshotStore(client, BodyObjectStoreConfig(bucket = "b"))
        whenever(client.put(any(), any())).thenThrow(RuntimeException("boom"))
        assertNull(store.put("saved", owner, "a1", "<p>x</p>"))
    }
}
