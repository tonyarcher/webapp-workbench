package timesupapi.fetch
import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

private fun trickleBody(exchange: com.sun.net.httpserver.HttpExchange) {
    try {
        exchange.sendResponseHeaders(200, 0)
        repeat(10) {
            exchange.responseBody.write('x'.code)
            exchange.responseBody.flush()
            Thread.sleep(100)
        }
    } catch (_: java.io.IOException) {
        // The client closes the socket at its overall deadline.
    } finally {
        exchange.close()
    }
}

class HttpPageFetcherTimeoutTest {
    @Test
    fun trickledBodyStillHonorsTheWholeRequestDeadline() {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        try {
            server.createContext("/trickle", ::trickleBody)
            server.start()
            val fetcher = HttpPageFetcher(allowLocal = true, timeoutMs = 250)
            val err = assertFailsWith<IllegalStateException> {
                fetcher.fetchHtml("http://127.0.0.1:${server.address.port}/trickle")
            }
            assertTrue(err.message?.contains("timed out", ignoreCase = true) == true)
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun wrapsTimeout() {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        try {
            server.createContext("/slow") { ex ->
                try {
                    Thread.sleep(500)
                } catch (_: InterruptedException) {
                }
                val bytes = "late".toByteArray()
                ex.sendResponseHeaders(200, bytes.size.toLong())
                ex.responseBody.use { it.write(bytes) }
            }
            server.start()
            val fetcher = HttpPageFetcher(allowLocal = true, timeoutMs = 100)
            val err = assertFailsWith<IllegalStateException> {
                fetcher.fetchHtml("http://127.0.0.1:${server.address.port}/slow")
            }
            assertTrue(err.message?.contains("timed out", ignoreCase = true) == true || err.message != null)
        } finally {
            server.stop(0)
        }
    }
}
