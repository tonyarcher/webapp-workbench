package timesupapi.platform

import jakarta.servlet.ReadListener
import jakarta.servlet.ServletInputStream
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyLong
import org.mockito.Mockito.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.mock.web.MockHttpServletRequest

class LimitedServletInputStreamTest {
    private fun delegate(text: String) = MockHttpServletRequest().apply { setContent(text.toByteArray()) }.inputStream

    private fun stream(max: Int, text: String = "abcdef") = LimitedServletInputStream(delegate(text), max.toLong())

    @Test
    fun singleByteReadsRejectOneExtraByteAndFindEndOfStream() {
        val limited = stream(2, "abc")
        assertEquals('a'.code, limited.read())
        assertEquals('b'.code, limited.read())
        assertThrows(RequestBodyTooLargeException::class.java) { limited.read() }
        val exact = stream(3, "ab")
        assertEquals('a'.code, exact.read())
        assertEquals('b'.code, exact.read())
        assertEquals(-1, exact.read())
    }

    @Test
    fun bulkReadsCountBytesAndRejectOverflow() {
        val limited = stream(3)
        val buffer = ByteArray(8)
        assertEquals(0, limited.read(buffer, 0, 0))
        assertEquals(2, limited.read(buffer, 0, 2))
        assertEquals("ab", String(buffer, 0, 2))
        assertEquals(1, limited.read(buffer, 2, 4))
        assertThrows(RequestBodyTooLargeException::class.java) { limited.read(buffer, 0, 1) }
    }

    @Test
    fun bulkReadAtExactLimitFindsEndOfStream() {
        val limited = stream(2, "ab")
        val buffer = ByteArray(4)
        assertEquals(2, limited.read(buffer, 0, 4))
        assertEquals(-1, limited.read(buffer, 0, 4))
    }

    @Test
    fun skipCountsAndRejectsOverflow() {
        val raw = mock(ServletInputStream::class.java)
        whenever(raw.skip(anyLong())).thenReturn(2L)
        whenever(raw.read()).thenReturn(-1)
        val limited = LimitedServletInputStream(raw, 2)
        assertEquals(0, limited.skip(0))
        assertEquals(2, limited.skip(5))
        assertEquals(0, limited.skip(1))
        val extra = mock(ServletInputStream::class.java)
        whenever(extra.skip(anyLong())).thenReturn(1L)
        whenever(extra.read()).thenReturn(99)
        val limitedExtra = LimitedServletInputStream(extra, 1)
        assertEquals(1, limitedExtra.skip(3))
        assertThrows(RequestBodyTooLargeException::class.java) { limitedExtra.skip(3) }
    }

    @Test
    fun delegatesStreamStatus() {
        val raw = mock(ServletInputStream::class.java)
        val limited = LimitedServletInputStream(raw, 4)
        limited.isReady
        limited.available()
        limited.isFinished
        val listener = mock(ReadListener::class.java)
        limited.setReadListener(listener)
        verify(raw).setReadListener(listener)
        assertTrue(limited.available() >= 0)
    }
}
