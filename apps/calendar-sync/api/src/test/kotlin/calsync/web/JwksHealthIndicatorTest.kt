package calsync.web

import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.Test
import org.springframework.boot.health.contributor.Status
import java.net.InetSocketAddress
import kotlin.test.assertEquals

class JwksHealthIndicatorTest {
    private fun server(status: Int): HttpServer {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/") { exchange ->
            try {
                val bytes = "{}".toByteArray()
                exchange.sendResponseHeaders(status, bytes.size.toLong())
                exchange.responseBody.use { it.write(bytes) }
            } finally {
                exchange.close()
            }
        }
        server.start()
        return server
    }

    @Test
    fun reachableJwksIsUp() {
        val server = server(200)
        try {
            val health = JwksHealthIndicator("http://127.0.0.1:${server.address.port}/jwks").health()
            assertEquals(Status.UP, health.status)
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun failingJwksIsDown() {
        val server = server(500)
        try {
            val health = JwksHealthIndicator("http://127.0.0.1:${server.address.port}/jwks").health()
            assertEquals(Status.DOWN, health.status)
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun refusedConnectionIsDown() {
        val health = JwksHealthIndicator("http://127.0.0.1:1/jwks").health()
        assertEquals(Status.DOWN, health.status)
    }

    @Test
    fun interruptBecomesDown() {
        val hanging = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        hanging.createContext("/") {
            try {
                Thread.sleep(30_000)
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
            } finally {
                it.close()
            }
        }
        hanging.start()
        try {
            val indicator = JwksHealthIndicator("http://127.0.0.1:${hanging.address.port}/jwks")
            var result: org.springframework.boot.health.contributor.Health? = null
            val worker = Thread { result = indicator.health() }
            worker.start()
            Thread.sleep(500)
            worker.interrupt()
            worker.join(10_000)
            assertEquals(Status.DOWN, result?.status)
        } finally {
            hanging.stop(0)
        }
    }

    @Test
    fun malformedUriIsDown() {
        val health = JwksHealthIndicator("://bad").health()
        assertEquals(Status.DOWN, health.status)
    }
}
