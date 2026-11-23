package rssapi.storage
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ObjectTextTest {
    private val text = "<p>hello</p> ".repeat(200)

    @Test
    fun roundTripsThroughGzip() {
        val encoded = ObjectText.encode(text)
        assertTrue(ObjectText.isGzip(encoded))
        assertTrue(encoded.size < text.length)
        assertEquals(text, ObjectText.decode(encoded))
    }

    @Test
    fun plainPayloadIsNotCompressed() {
        val bytes = text.toByteArray(Charsets.UTF_8)
        assertFalse(ObjectText.isGzip(bytes))
        assertEquals(text, ObjectText.decode(bytes))
    }

    @Test
    fun gunzipLeavesPlainBytesAlone() {
        val bytes = "plain".toByteArray(Charsets.UTF_8)
        assertEquals("plain", ObjectText.gunzip(bytes).toString(Charsets.UTF_8))
    }

    @Test
    fun emptyAndShortPayloadsAreSafe() {
        assertFalse(ObjectText.isGzip(ByteArray(0)))
        assertFalse(ObjectText.isGzip(byteArrayOf(0x1f)))
    }

    @Test
    fun mismatchedSecondMagicByteIsNotGzip() {
        assertFalse(ObjectText.isGzip(byteArrayOf(0x1f, 0x00)))
    }

    @Test
    fun corruptGzipDecodesToNull() {
        val truncated = ObjectText.encode(text).copyOfRange(0, 10)
        assertTrue(ObjectText.isGzip(truncated))
        assertNull(ObjectText.decode(truncated))
    }
}
