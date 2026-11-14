package rssapi.fetch

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.nio.charset.StandardCharsets
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class HttpPageFetcherTest {
    private lateinit var server: HttpServer
    private lateinit var base: String
    private val fetcher = HttpPageFetcher(allowLocal = true)

    @BeforeTest
    fun setUp() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.start()
        base = "http://127.0.0.1:${server.address.port}"
    }

    @AfterTest
    fun tearDown() {
        server.stop(0)
    }

    @Test
    fun fetchesHtmlBody() {
        server.createContext("/ok") { ex ->
            val bytes = "<html><body>hello</body></html>".toByteArray()
            ex.responseHeaders.add("Content-Type", "text/html; charset=utf-8")
            ex.sendResponseHeaders(200, bytes.size.toLong())
            ex.responseBody.use { it.write(bytes) }
        }
        val html = fetcher.fetchHtml("$base/ok")
        assertTrue(html.contains("hello"))
    }

    @Test
    fun followsRedirects() {
        server.createContext("/a") { ex ->
            ex.responseHeaders.add("Location", "$base/b")
            ex.sendResponseHeaders(302, -1)
            ex.close()
        }
        server.createContext("/b") { ex ->
            val bytes = "done".toByteArray()
            ex.sendResponseHeaders(200, bytes.size.toLong())
            ex.responseBody.use { it.write(bytes) }
        }
        assertEquals("done", fetcher.fetchHtml("$base/a"))
    }

    @Test
    fun failsOnHttpError() {
        server.createContext("/bad") { ex ->
            ex.sendResponseHeaders(404, -1)
            ex.close()
        }
        assertFailsWith<IllegalStateException> { fetcher.fetchHtml("$base/bad") }
    }

    @Test
    fun failsOnTooManyRedirects() {
        server.createContext("/loop") { ex ->
            ex.responseHeaders.add("Location", "$base/loop")
            ex.sendResponseHeaders(302, -1)
            ex.close()
        }
        assertFailsWith<IllegalStateException> { fetcher.fetchHtml("$base/loop") }
    }

    @Test
    fun honorsCharset() {
        server.createContext("/latin") { ex ->
            val text = "café"
            val bytes = text.toByteArray(StandardCharsets.ISO_8859_1)
            ex.responseHeaders.add("Content-Type", "text/html; charset=iso-8859-1")
            ex.sendResponseHeaders(200, bytes.size.toLong())
            ex.responseBody.use { it.write(bytes) }
        }
        val html = fetcher.fetchHtml("$base/latin")
        assertTrue(html.contains("café"))
    }

    @Test
    fun defaultsCharsetOnUnknown() {
        server.createContext("/plain") { ex ->
            val bytes = "hi".toByteArray()
            ex.responseHeaders.add("Content-Type", "text/html; charset=bogus-charset")
            ex.sendResponseHeaders(200, bytes.size.toLong())
            ex.responseBody.use { it.write(bytes) }
        }
        assertEquals("hi", fetcher.fetchHtml("$base/plain"))
    }
}
