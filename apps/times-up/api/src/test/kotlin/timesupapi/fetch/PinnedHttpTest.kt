package timesupapi.fetch

import com.sun.net.httpserver.HttpServer
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

private fun trickleHandshake(server: ServerSocket): Thread = Thread {
    server.accept().use { socket ->
        val output = socket.getOutputStream()
        output.write(byteArrayOf(0x16, 0x03, 0x03, 0, 2))
        output.flush()
        output.write(2)
        output.flush()
        Thread.sleep(1_000)
    }
}

class PinnedHttpTest {
    @Test
    fun fallsBackToAnotherValidatedAddress() {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/") { ex ->
            val body = "ok".toByteArray()
            ex.sendResponseHeaders(200, body.size.toLong())
            ex.responseBody.use { it.write(body) }
            ex.close()
        }
        server.start()
        try {
            val resolver = PublicDnsResolver(true, resolve = {
                arrayOf(InetAddress.getByName("127.0.0.2"), InetAddress.getByName("127.0.0.1"))
            })
            val response = sendPinned(
                "http://127.0.0.1:${server.address.port}?x=1",
                resolver,
                1_000,
                mapOf("Host" to "127.0.0.1"),
                1024,
            )
            assertEquals("ok", String(response.body))
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun trickledTlsHandshakeHonorsTheDeadline() {
        val server = ServerSocket(0)
        val worker = trickleHandshake(server)
        worker.start()
        try {
            assertFailsWith<java.io.IOException> {
                sendPinned(
                    "https://127.0.0.1:${server.localPort}/",
                    PublicDnsResolver(true),
                    250,
                    emptyMap(),
                    1024,
                )
            }
        } finally {
            server.close()
            worker.join(1_000)
        }
    }

    @Test
    fun rejectsHeaderInjection() {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.start()
        try {
            assertFailsWith<IllegalArgumentException> {
                sendPinned(
                    "http://127.0.0.1:${server.address.port}/",
                    PublicDnsResolver(true),
                    1_000,
                    mapOf("X-Test" to "ok\r\nInjected: yes"),
                    1024,
                )
            }
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun rejectsHeaderNameInjection() {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.start()
        try {
            assertFailsWith<IllegalArgumentException> {
                sendPinned(
                    "http://127.0.0.1:${server.address.port}/",
                    PublicDnsResolver(true),
                    1_000,
                    mapOf("X-Test\r\nInjected" to "yes"),
                    1024,
                )
            }
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun tlsFailureIsReturnedAsIoFailure() {
        assertFailsWith<java.io.IOException> {
            sendPinned("https://127.0.0.1:1/", PublicDnsResolver(true), 1_000, emptyMap(), 1024)
        }
    }
}
