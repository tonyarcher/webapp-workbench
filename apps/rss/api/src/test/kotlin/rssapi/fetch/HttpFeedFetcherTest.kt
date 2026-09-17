package rssapi.fetch

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class HttpFeedFetcherTest {
    private fun server(handler: (com.sun.net.httpserver.HttpExchange) -> Unit): Pair<HttpServer, String> {
        val srv = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        srv.createContext("/") { ex ->
            try {
                handler(ex)
            } finally {
                ex.close()
            }
        }
        srv.start()
        return srv to "http://127.0.0.1:${srv.address.port}/"
    }

    private fun bytes(text: String, code: Int = 200, headers: Map<String, String> = emptyMap()) =
        { ex: com.sun.net.httpserver.HttpExchange ->
            headers.forEach { (k, v) -> ex.responseHeaders.add(k, v) }
            val body = text.toByteArray()
            ex.sendResponseHeaders(code, body.size.toLong())
            ex.responseBody.use { it.write(body) }
        }

    @Test
    fun fetchOkWithHeaders() {
        val (srv, base) = server(bytes("<rss/>", 200, mapOf("ETag" to "e1")))
        try {
            val res = HttpFeedFetcher(allowLocal = true).fetch(base)
            assertEquals(200, res.status)
            assertEquals("<rss/>", res.text)
            assertEquals("e1", res.etag)
        } finally {
            srv.stop(0)
        }
    }

    @Test
    fun notModified() {
        val (srv, base) = server(bytes("", 304))
        try {
            val res = HttpFeedFetcher(allowLocal = true).fetch(base, etag = "e1")
            assertEquals(304, res.status)
        } finally {
            srv.stop(0)
        }
    }

    @Test
    fun httpErrorThrows() {
        val (srv, base) = server(bytes("nope", 500))
        try {
            assertFailsWith<IllegalStateException> {
                HttpFeedFetcher(allowLocal = true).fetch(base)
            }
        } finally {
            srv.stop(0)
        }
    }

    @Test
    fun redirectFollows() {
        val (srv, base) = server { ex ->
            if (ex.requestURI.path == "/go") {
                ex.responseHeaders.add("location", "/feed")
                ex.sendResponseHeaders(302, -1)
            } else {
                val body = "<rss/>".toByteArray()
                ex.sendResponseHeaders(200, body.size.toLong())
                ex.responseBody.use { it.write(body) }
            }
        }
        try {
            val res = HttpFeedFetcher(allowLocal = true).fetch("${base}go")
            assertEquals(200, res.status)
        } finally {
            srv.stop(0)
        }
    }

    @Test
    fun redirectLoopThrows() {
        val (srv, base) = server { ex ->
            ex.responseHeaders.add("location", "/loop")
            ex.sendResponseHeaders(302, -1)
        }
        try {
            assertFailsWith<IllegalStateException> {
                HttpFeedFetcher(allowLocal = true).fetch("${base}loop")
            }
        } finally {
            srv.stop(0)
        }
    }

    @Test
    fun localBlockedWithoutFlag() {
        val (srv, base) = server(bytes("<rss/>"))
        try {
            assertFailsWith<IllegalArgumentException> {
                HttpFeedFetcher(allowLocal = false).fetch(base)
            }
        } finally {
            srv.stop(0)
        }
    }

    @Test
    fun deadPortThrows() {
        assertFailsWith<IllegalStateException> {
            HttpFeedFetcher(allowLocal = true).fetch("http://127.0.0.1:1/rss")
        }
    }

    @Test
    fun conditionalHeadersSent() {
        val (srv, base) = server { ex ->
            val inm = ex.requestHeaders.getFirst("If-None-Match")
            val ims = ex.requestHeaders.getFirst("If-Modified-Since")
            if (inm == "e1" && ims == "m1") {
                ex.sendResponseHeaders(304, -1)
            } else {
                val body = "<rss/>".toByteArray()
                ex.sendResponseHeaders(200, body.size.toLong())
                ex.responseBody.use { it.write(body) }
            }
        }
        try {
            val res = HttpFeedFetcher(allowLocal = true).fetch(base, etag = "e1", lastModified = "m1")
            assertEquals(304, res.status)
        } finally {
            srv.stop(0)
        }
    }

    @Test
    fun redirectWithoutLocationThrows() {
        val (srv, base) = server { ex ->
            ex.sendResponseHeaders(302, -1)
        }
        try {
            assertFailsWith<IllegalStateException> {
                HttpFeedFetcher(allowLocal = true).fetch(base)
            }
        } finally {
            srv.stop(0)
        }
    }
}
