package calsync.trakt

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.Test
import java.net.InetSocketAddress
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class TraktClientTest {
    private fun server(handler: (HttpExchange) -> Unit): HttpServer {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/") { exchange ->
            try {
                handler(exchange)
            } finally {
                exchange.close()
            }
        }
        server.start()
        return server
    }

    private fun clientOf(server: HttpServer): JdkTraktHttp =
        JdkTraktHttp(base = "http://127.0.0.1:${server.address.port}")

    private fun answer(exchange: HttpExchange, status: Int, body: String) {
        val bytes = body.toByteArray()
        exchange.sendResponseHeaders(status, bytes.size.toLong())
        exchange.responseBody.use { it.write(bytes) }
    }

    @Test
    fun getMapsStatusAndBody() {
        val server = server { answer(it, 200, "[]") }
        try {
            assertEquals(TraktReply(200, "[]"), clientOf(server).get("/x", mapOf("H" to "v")))
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun postSendsBody() {
        var seen = ""
        val server = server { exchange ->
            seen = exchange.requestBody.bufferedReader().readText()
            answer(exchange, 201, "{}")
        }
        try {
            val reply = clientOf(server).post("/y", emptyMap(), """{"a":1}""")
            assertEquals(TraktReply(201, "{}"), reply)
            assertEquals("""{"a":1}""", seen)
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun refusedConnectionBecomesTransport() {
        val dead = JdkTraktHttp(base = "http://127.0.0.1:1")
        assertFailsWith<TraktTransportException> { dead.get("/x", emptyMap()) }
    }

    @Test
    fun malformedBaseBecomesTransport() {
        val bad = JdkTraktHttp(base = "://bad")
        assertFailsWith<TraktTransportException> { bad.get("/x", emptyMap()) }
    }
}
