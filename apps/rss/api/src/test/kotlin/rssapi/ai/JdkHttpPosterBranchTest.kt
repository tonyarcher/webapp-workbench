package rssapi.ai

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class JdkHttpPosterBranchTest {
    private fun server(code: Int, body: String): Pair<HttpServer, String> {
        val srv = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        srv.createContext("/") { ex ->
            try {
                val bytes = body.toByteArray()
                ex.sendResponseHeaders(code, bytes.size.toLong())
                ex.responseBody.use { it.write(bytes) }
            } finally {
                ex.close()
            }
        }
        srv.start()
        return srv to "http://127.0.0.1:${srv.address.port}/"
    }

    @Test
    fun getPostDelete() {
        val (srv, base) = server(200, "hello")
        try {
            val poster = JdkHttpPoster()
            assertEquals("hello", poster.get(base, emptyMap(), 5_000L).body)
            assertEquals("hello", poster.post(base, emptyMap(), "{}", 5_000L).body)
            assertEquals(200, poster.delete(base, emptyMap(), 5_000L).status)
        } finally {
            srv.stop(0)
        }
    }

    @Test
    fun badUrlThrows() {
        assertFailsWith<AiException> {
            JdkHttpPoster().get("ht!tp:// bad", emptyMap(), 5_000L)
        }
    }

    @Test
    fun helpers() {
        assertEquals(emptyMap(), basicAuth("", "x"))
        assertTrue(basicAuth("u", "p")["Authorization"]?.startsWith("Basic ") == true)
        assertEquals("ok", requireOk(HttpResult(200, "ok"), "x"))
        assertFailsWith<AiException> { requireOk(HttpResult(500, "e"), "svc") }
        assertFailsWith<AiException> { parseBody("not json", "svc") }
    }
}
