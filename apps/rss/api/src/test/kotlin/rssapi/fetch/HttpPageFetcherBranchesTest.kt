package rssapi.fetch

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import kotlin.test.Test
import kotlin.test.assertFailsWith

class HttpPageFetcherBranchesTest {
    @Test
    fun redirectWithoutLocationFails() {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        try {
            server.createContext("/redir") { ex ->
                ex.sendResponseHeaders(302, -1)
                ex.close()
            }
            server.start()
            val fetcher = HttpPageFetcher(allowLocal = true)
            assertFailsWith<IllegalStateException> {
                fetcher.fetchHtml("http://127.0.0.1:${server.address.port}/redir")
            }
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun redirectChainExceedsLimit() {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        try {
            for (i in 0..6) {
                val idx = i
                server.createContext("/r$idx") { ex ->
                    ex.responseHeaders.add("Location", "http://127.0.0.1:${server.address.port}/r${idx + 1}")
                    ex.sendResponseHeaders(302, -1)
                    ex.close()
                }
            }
            server.start()
            val fetcher = HttpPageFetcher(allowLocal = true)
            assertFailsWith<IllegalStateException> {
                fetcher.fetchHtml("http://127.0.0.1:${server.address.port}/r0")
            }
        } finally {
            server.stop(0)
        }
    }
}
