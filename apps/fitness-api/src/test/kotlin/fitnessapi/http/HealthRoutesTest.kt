package fitnessapi.http

import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlin.test.Test
import kotlin.test.assertEquals
import fitnessapi.module

class HealthRoutesTest {
    @Test
    fun healthzOkWithoutDatabase() = testApplication {
        application { module(TEST_SETTINGS, dataSource = null) }
        val response = client.get("/healthz")
        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("""{"ok":true}""", response.bodyAsText())
    }

    @Test
    fun readyzUnavailableWithoutDatabase() = testApplication {
        application { module(TEST_SETTINGS, dataSource = null) }
        val response = client.get("/readyz")
        assertEquals(HttpStatusCode.ServiceUnavailable, response.status)
        assertEquals("""{"ok":false}""", response.bodyAsText())
    }

    @Test
    fun echoesRequestId() = testApplication {
        application { module(TEST_SETTINGS, dataSource = null) }
        val response = client.get("/healthz") {
            header("X-Request-ID", "req-1")
        }
        assertEquals("req-1", response.headers["X-Request-ID"])
    }
}
