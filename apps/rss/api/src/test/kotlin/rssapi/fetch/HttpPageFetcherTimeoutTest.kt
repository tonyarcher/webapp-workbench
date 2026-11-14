package rssapi.fetch

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class HttpPageFetcherTimeoutTest {
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
