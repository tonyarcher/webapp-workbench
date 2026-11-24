package timesupapi.fetch

import java.io.BufferedInputStream
import java.io.ByteArrayInputStream
import java.nio.charset.StandardCharsets.ISO_8859_1
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class HttpResponseReaderTest {
    private fun read(text: String, maxBytes: Int = 1024) =
        readResponse(BufferedInputStream(ByteArrayInputStream(text.toByteArray(ISO_8859_1))), maxBytes)

    @Test
    fun readsSizedAndChunkedBodies() {
        val sized = read("HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nbody")
        assertContentEquals("body".toByteArray(), sized.body)
        val chunked =
            read("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\nhi\r\n1\r\n!\r\n0\r\nX: y\r\n\r\n")
        assertContentEquals("hi!".toByteArray(), chunked.body)
        val noTrailers = read("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n")
        assertEquals(0, noTrailers.body.size)
        val notChunked = read("HTTP/1.1 200 OK\r\nTransfer-Encoding: gzip\r\nContent-Length: 2\r\n\r\nhi")
        assertContentEquals("hi".toByteArray(), notChunked.body)
    }

    @Test
    fun bodylessStatusesDoNotReadABody() {
        assertEquals(0, read("HTTP/1.1 204 No Content\r\n\r\nignored").body.size)
        assertEquals(0, read("HTTP/1.1 304 Not Modified\r\n\r\nignored").body.size)
        assertEquals(0, read("HTTP/1.1 100 Continue\r\n\r\nignored").body.size)
    }

    @Test
    fun unknownLengthReadsUntilEof() {
        assertContentEquals("body".toByteArray(), read("HTTP/1.1 200 OK\r\n\r\nbody").body)
    }

    @Test
    fun rejectsOversizedBodiesBeforeAndDuringRead() {
        assertFailsWith<BodyTooLargeException> {
            read("HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nbody", maxBytes = 3)
        }
        assertFailsWith<BodyTooLargeException> {
            read("HTTP/1.1 200 OK\r\n\r\nbody", maxBytes = 3)
        }
        assertFailsWith<BodyTooLargeException> {
            read("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nbody\r\n0\r\n\r\n", maxBytes = 3)
        }
    }

    @Test
    fun rejectsMalformedStatusAndHeaders() {
        assertFailsWith<Exception> { read("") }
        assertFailsWith<Exception> { read("HTTP/1.1 nope\r\n\r\n") }
        assertFailsWith<Exception> { read("HTTP/1.1 200 OK\r\nBadHeader\r\n\r\n") }
        assertFailsWith<Exception> { read("HTTP/1.1 200 OK\r\nContent-Length: -1\r\n\r\n") }
    }

    @Test
    fun rejectsHeaderAndLineLimits() {
        val tooMany = buildString {
            append("HTTP/1.1 200 OK\r\n")
            repeat(101) { append("X-$it: y\r\n") }
            append("\r\n")
        }
        assertFailsWith<Exception> { read(tooMany) }
        val tooLarge = "HTTP/1.1 200 OK\r\nX: ${"a".repeat(70_000)}\r\n\r\n"
        assertFailsWith<Exception> { read(tooLarge) }
        val tooManyBytes = buildString {
            append("HTTP/1.1 200 OK\r\n")
            repeat(70) { append("X-$it: ${"a".repeat(1_000)}\r\n") }
            append("\r\n")
        }
        assertFailsWith<Exception> { read(tooManyBytes) }
    }

    @Test
    fun rejectsTruncatedAndMalformedChunks() {
        val prefix = "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n"
        assertFailsWith<Exception> { read(prefix) }
        assertFailsWith<Exception> { read("${prefix}zz\r\n") }
        assertFailsWith<Exception> { read("$prefix-1\r\n") }
        assertFailsWith<Exception> { read("${prefix}4\r\nhi") }
        assertFailsWith<Exception> { read("HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nhi") }
    }
}
