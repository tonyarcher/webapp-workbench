package timesupapi.fetch

import java.io.BufferedInputStream
import java.io.IOException
import java.io.InputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URI
import java.nio.charset.Charset
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket

internal class BodyTooLargeException : IOException("response body too large")
internal class InvalidHttpResponseException(message: String) : IOException(message)

private const val NANOS_PER_MILLI = 1_000_000L
private const val ROUNDING_NANOS = 999_999L

internal data class PinnedResponse(val status: Int, val headers: Map<String, List<String>>, val body: ByteArray)

private data class HttpTarget(
    val host: String,
    val port: Int,
    val tls: Boolean,
    val authority: String,
    val requestTarget: String,
)

/** One direct HTTP(S) request using only the DNS addresses validated by [resolver]. */
internal fun sendPinned(
    rawUrl: String,
    resolver: PublicDnsResolver,
    timeoutMs: Long,
    requestHeaders: Map<String, String>,
    maxBytes: Int,
): PinnedResponse {
    val target = targetOf(rawUrl, resolver.allowLocal)
    val deadline = System.nanoTime() + timeoutMs * NANOS_PER_MILLI
    var lastError: IOException? = null
    for (address in resolver.lookup(target.host)) {
        try {
            return exchange(target, requestHeaders, timeoutMs, maxBytes, address, deadline)
        } catch (err: IOException) {
            lastError = err
        }
    }
    throw lastError ?: IOException("unresolvable host")
}

private fun targetOf(rawUrl: String, allowLocal: Boolean): HttpTarget {
    assertPublicUrl(rawUrl, allowLocal)
    val uri = URI(rawUrl)
    val host = uri.host.removePrefix("[").removeSuffix("]")
    val tls = uri.scheme.equals("https", ignoreCase = true)
    val port = if (uri.port >= 0) {
        uri.port
    } else if (tls) {
        443
    } else {
        80
    }
    val requestTarget = buildString {
        append(uri.rawPath?.takeIf { it.isNotEmpty() } ?: "/")
        uri.rawQuery?.let { append('?').append(it) }
    }
    val hostHeader = if (host.contains(':')) "[$host]" else host
    val authority = if (uri.port >= 0) "$hostHeader:$port" else hostHeader
    return HttpTarget(host, port, tls, authority, requestTarget)
}

private fun exchange(
    target: HttpTarget,
    requestHeaders: Map<String, String>,
    timeoutMs: Long,
    maxBytes: Int,
    address: InetAddress,
    deadlineNanos: Long,
): PinnedResponse {
    val raw = Socket()
    return try {
        val remaining = deadlineNanos - System.nanoTime()
        if (remaining <= 0) throw java.net.SocketTimeoutException("Request timed out")
        val connectTimeout = minOf(timeoutMs, (remaining + ROUNDING_NANOS) / NANOS_PER_MILLI).toInt().coerceAtLeast(1)
        raw.connect(InetSocketAddress(address, target.port), connectTimeout)
        armTimeout(raw, deadlineNanos)
        val socket = openSocket(raw, target, deadlineNanos)
        try {
            val buffered = BufferedInputStream(socket.getInputStream())
            val input = DeadlineInputStream(buffered, socket, deadlineNanos)
            armTimeout(socket, deadlineNanos)
            writeRequest(socket, target, requestHeaders)
            readResponse(input, maxBytes)
        } finally {
            runCatching { socket.close() }
        }
    } finally {
        runCatching { raw.close() }
    }
}

private fun armTimeout(socket: Socket, deadlineNanos: Long) {
    val remaining = deadlineNanos - System.nanoTime()
    if (remaining <= 0) throw java.net.SocketTimeoutException("Request timed out")
    socket.soTimeout = ((remaining + ROUNDING_NANOS) / NANOS_PER_MILLI).toInt().coerceAtLeast(1)
}

private class DeadlineInputStream(
    private val input: InputStream,
    private val socket: Socket,
    private val deadlineNanos: Long,
) : InputStream() {
    override fun read(): Int {
        armTimeout(socket, deadlineNanos)
        return input.read()
    }

    override fun read(bytes: ByteArray, offset: Int, length: Int): Int {
        armTimeout(socket, deadlineNanos)
        return input.read(bytes, offset, length)
    }
}

private fun openSocket(raw: Socket, target: HttpTarget, deadlineNanos: Long): Socket {
    if (!target.tls) return raw
    armTimeout(raw, deadlineNanos)
    val ssl = SSLContext.getDefault().socketFactory.createSocket(raw, target.host, target.port, true) as SSLSocket
    val params = ssl.sslParameters.apply { endpointIdentificationAlgorithm = "HTTPS" }
    ssl.sslParameters = params
    awaitHandshake(ssl, deadlineNanos)
    return ssl
}

private fun awaitHandshake(ssl: SSLSocket, deadlineNanos: Long) {
    ensureNotInterrupted(ssl)
    val handshake = CompletableFuture.runAsync { ssl.startHandshake() }
    handshake.orTimeout(remainingNanos(deadlineNanos), TimeUnit.NANOSECONDS)
    try {
        handshake.join()
    } catch (err: java.util.concurrent.CompletionException) {
        throw handshakeFailure(ssl, handshake, err)
    }
}

private fun handshakeFailure(
    ssl: SSLSocket,
    handshake: CompletableFuture<Void>,
    err: java.util.concurrent.CompletionException,
): IOException {
    handshake.cancel(true)
    runCatching { ssl.close() }
    return if (err.cause is TimeoutException) {
        java.net.SocketTimeoutException("Request timed out").apply { initCause(err.cause) }
    } else {
        IOException("TLS handshake failed", err)
    }
}

private fun ensureNotInterrupted(ssl: SSLSocket) {
    if (!Thread.currentThread().isInterrupted) return
    runCatching { ssl.close() }
    throw IOException("TLS handshake interrupted")
}

private fun remainingNanos(deadlineNanos: Long): Long {
    val remaining = deadlineNanos - System.nanoTime()
    if (remaining <= 0) throw java.net.SocketTimeoutException("Request timed out")
    return remaining
}

private fun writeRequest(socket: Socket, target: HttpTarget, requestHeaders: Map<String, String>) {
    val lines = mutableListOf(
        "GET ${target.requestTarget} HTTP/1.1",
        "Host: ${target.authority}",
        "Connection: close",
        "Accept-Encoding: identity",
    )
    requestHeaders.forEach { (name, value) ->
        require(!name.contains('\r') && !name.contains('\n') && !value.contains('\r') && !value.contains('\n')) {
            "Invalid request header"
        }
        if (!lines.any { it.startsWith("$name:", ignoreCase = true) }) lines.add("$name: $value")
    }
    val bytes = (lines.joinToString("\r\n", postfix = "\r\n\r\n")).toByteArray(Charsets.ISO_8859_1)
    val output = socket.getOutputStream()
    output.write(bytes)
    output.flush()
}
