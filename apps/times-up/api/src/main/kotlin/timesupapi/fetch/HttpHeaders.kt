package timesupapi.fetch

import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.InputStream
import java.nio.charset.Charset

private const val HEADER_LINE_LIMIT = 16 * 1024
private const val HEADER_TOTAL_LIMIT = 64 * 1024
private const val MAX_HEADERS = 100
private const val INITIAL_LINE_BYTES = 256

internal fun readHeaders(input: InputStream): Map<String, List<String>> {
    val headers = linkedMapOf<String, MutableList<String>>()
    var total = 0
    while (headers.size < MAX_HEADERS) {
        val line = readLine(input) ?: throw EOFException("truncated HTTP headers")
        if (line.isEmpty()) return headers
        total += line.length
        checkHeaderTotal(total)
        val (name, value) = parseHeaderLine(line)
        headers.getOrPut(name) { mutableListOf() }.add(value)
    }
    throw InvalidHttpResponseException("too many HTTP headers")
}

private fun checkHeaderTotal(total: Int) {
    if (total > HEADER_TOTAL_LIMIT) throw InvalidHttpResponseException("HTTP headers too large")
}

private fun parseHeaderLine(line: String): Pair<String, String> {
    val separator = line.indexOf(':')
    if (separator <= 0) throw InvalidHttpResponseException("bad HTTP header")
    return line.substring(0, separator).trim().lowercase() to line.substring(separator + 1).trim()
}

internal fun readLine(input: InputStream): String? {
    val out = ByteArrayOutputStream(INITIAL_LINE_BYTES)
    while (out.size() < HEADER_LINE_LIMIT) {
        val value = input.read()
        if (value < 0) return if (out.size() == 0) null else out.toString(Charsets.ISO_8859_1.name())
        if (value == '\n'.code) return out.toString(Charsets.ISO_8859_1.name()).removeSuffix("\r")
        out.write(value)
    }
    throw InvalidHttpResponseException("HTTP line too long")
}
