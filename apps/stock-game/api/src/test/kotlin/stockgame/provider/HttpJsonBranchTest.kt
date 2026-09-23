package stockgame.provider

import com.sun.net.httpserver.HttpServer
import stockgame.domain.ProviderError
import java.net.InetSocketAddress
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class HttpJsonBranchTest {
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
    fun okParses() {
        val (srv, base) = server(200, """{"a":1}""")
        try {
            assertEquals(1, fetchJson(base, "test").get("a").asInt())
        } finally {
            srv.stop(0)
        }
    }

    @Test
    fun rateLimitThrows() {
        val (srv, base) = server(429, "slow")
        try {
            assertFailsWith<ProviderError> { fetchJson(base, "test") }
        } finally {
            srv.stop(0)
        }
    }

    @Test
    fun otherStatusThrows() {
        val (srv, base) = server(500, "err")
        try {
            assertFailsWith<ProviderError> { fetchJson(base, "test") }
        } finally {
            srv.stop(0)
        }
    }
}
