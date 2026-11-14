package rssapi.fetch

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class HttpPageFetcherMoreTest {
    @Test
    fun wrapsConnectionFailure() {
        val fetcher = HttpPageFetcher(allowLocal = true)
        // closed local port should fail fast and go through wrapFetch
        assertFailsWith<IllegalStateException> { fetcher.fetchHtml("http://127.0.0.1:1/x") }
    }

    @Test
    fun rejectsTooLargeBody() {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        try {
            server.createContext("/big") { ex ->
                val bytes = ByteArray(5 * 1024 * 1024 + 1) { 'a'.code.toByte() }
                ex.sendResponseHeaders(200, bytes.size.toLong())
                ex.responseBody.use { it.write(bytes) }
            }
            server.start()
            val fetcher = HttpPageFetcher(allowLocal = true)
            val err = assertFailsWith<IllegalStateException> {
                fetcher.fetchHtml("http://127.0.0.1:${server.address.port}/big")
            }
            assertTrue(err.message?.contains("too large") == true)
        } finally {
            server.stop(0)
        }
    }
}
