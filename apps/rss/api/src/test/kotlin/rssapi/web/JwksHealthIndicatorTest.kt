package rssapi.web

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.boot.health.contributor.Status
import java.io.IOException
import java.net.http.HttpClient
import java.net.http.HttpResponse

class JwksHealthIndicatorTest {
    private val client: HttpClient = mock()

    @Test
    fun upOn2xx() {
        val response: HttpResponse<Void> = mock()
        whenever(response.statusCode()).thenReturn(200)
        whenever(
            client.send(any<java.net.http.HttpRequest>(), any<HttpResponse.BodyHandler<Void>>()),
        ).thenReturn(response)

        val health = JwksHealthIndicator("https://issuer/jwks", client).health()

        assertEquals(Status.UP, health.status)
    }

    @Test
    fun downOnNon2xx() {
        val response: HttpResponse<Void> = mock()
        whenever(response.statusCode()).thenReturn(503)
        whenever(
            client.send(any<java.net.http.HttpRequest>(), any<HttpResponse.BodyHandler<Void>>()),
        ).thenReturn(response)

        val health = JwksHealthIndicator("https://issuer/jwks", client).health()

        assertEquals(Status.DOWN, health.status)
    }

    @Test
    fun downOnIoException() {
        whenever(client.send(any<java.net.http.HttpRequest>(), any<HttpResponse.BodyHandler<Void>>()))
            .thenThrow(IOException("no"))

        val health = JwksHealthIndicator("https://issuer/jwks", client).health()

        assertEquals(Status.DOWN, health.status)
    }

    @Test
    fun downOnInterruptedException() {
        whenever(client.send(any<java.net.http.HttpRequest>(), any<HttpResponse.BodyHandler<Void>>()))
            .thenThrow(InterruptedException("stop"))

        val health = JwksHealthIndicator("https://issuer/jwks", client).health()

        assertEquals(Status.DOWN, health.status)
    }

    @Test
    fun downOnBadUri() {
        val health = JwksHealthIndicator("not a uri", client).health()

        assertEquals(Status.DOWN, health.status)
    }
}
