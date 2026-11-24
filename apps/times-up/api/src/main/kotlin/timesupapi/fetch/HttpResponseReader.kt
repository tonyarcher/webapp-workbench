package timesupapi.fetch

import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.IOException
import java.io.InputStream

private const val NOT_MODIFIED = 304
private const val NO_CONTENT = 204
private const val FIRST_SUCCESS_STATUS = 200
private const val BUFFER_BYTES = 8192

internal fun readResponse(input: InputStream, maxBytes: Int): PinnedResponse {
    val statusLine = readLine(input) ?: throw EOFException("empty HTTP response")
    val status = statusLine.split(' ').getOrNull(1)?.toIntOrNull() ?: throw IOException("bad HTTP status")
    val headers = readHeaders(input)
    return PinnedResponse(status, headers, responseBody(status, headers, input, maxBytes))
}

private fun responseBody(
    status: Int,
    headers: Map<String, List<String>>,
    input: InputStream,
    maxBytes: Int,
): ByteArray = when {
    status == NOT_MODIFIED || status == NO_CONTENT || status < FIRST_SUCCESS_STATUS -> ByteArray(0)

    headers["transfer-encoding"]?.any { it.contains("chunked", ignoreCase = true) } == true ->
        readChunked(input, maxBytes)

    else -> readSized(input, headers["content-length"]?.firstOrNull()?.toLongOrNull(), maxBytes)
}

private fun readSized(input: InputStream, contentLength: Long?, maxBytes: Int): ByteArray {
    if (contentLength != null && contentLength < 0) throw InvalidHttpResponseException("bad content length")
    if (contentLength != null && contentLength > maxBytes) throw BodyTooLargeException()
    return if (contentLength == null) readUntilEnd(input, maxBytes) else readExactly(input, contentLength.toInt())
}

private fun readUntilEnd(input: InputStream, maxBytes: Int): ByteArray {
    val out = ByteArrayOutputStream(BUFFER_BYTES)
    val buffer = ByteArray(BUFFER_BYTES)
    while (true) {
        val count = input.read(buffer)
        if (count < 0) return out.toByteArray()
        appendLimited(out, buffer, count, maxBytes)
    }
}

private fun readExactly(input: InputStream, length: Int): ByteArray {
    val out = ByteArrayOutputStream(length)
    val buffer = ByteArray(minOf(length, BUFFER_BYTES))
    var remaining = length
    while (remaining > 0) {
        val count = input.read(buffer, 0, minOf(remaining, buffer.size))
        if (count < 0) throw EOFException("truncated HTTP body")
        out.write(buffer, 0, count)
        remaining -= count
    }
    return out.toByteArray()
}

private fun readChunked(input: InputStream, maxBytes: Int): ByteArray {
    val out = ByteArrayOutputStream(BUFFER_BYTES)
    while (true) {
        val size = readChunkSize(input) ?: return out.toByteArray()
        val buffer = ByteArray(minOf(size, BUFFER_BYTES))
        var remaining = size
        while (remaining > 0) {
            val count = input.read(buffer, 0, minOf(remaining, buffer.size))
            if (count < 0) throw EOFException("truncated HTTP chunk")
            appendLimited(out, buffer, count, maxBytes)
            remaining -= count
        }
        readLine(input) ?: throw EOFException("truncated HTTP chunk")
    }
}

private fun readChunkSize(input: InputStream): Int? {
    val line = readLine(input) ?: throw EOFException("truncated chunk")
    val size = line.substringBefore(';').trim().toIntOrNull(16)?.takeIf { it >= 0 }
        ?: throw InvalidHttpResponseException("bad HTTP chunk")
    if (size == 0) {
        skipTrailers(input)
        return null
    }
    return size
}

private fun skipTrailers(input: InputStream) {
    while (true) {
        val trailer = readLine(input) ?: return
        if (trailer.isEmpty()) return
    }
}

private fun appendLimited(out: ByteArrayOutputStream, buffer: ByteArray, count: Int, maxBytes: Int) {
    if (out.size() + count > maxBytes) throw BodyTooLargeException()
    out.write(buffer, 0, count)
}
