package userapi.http

import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlin.test.Test
import kotlin.test.assertEquals
import userapi.Settings
import userapi.module

class HealthRoutesTest {
    private val settings = Settings(
        port = 3000,
        databaseUrl = "",
        logLevel = "error",
        service = "user-api",
    )

    @Test
    fun healthzOkWithoutDatabase() = testApplication {
        application { module(settings, dataSource = null) }
        val response = client.get("/healthz")
        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("""{"ok":true}""", response.bodyAsText())
    }

    @Test
    fun readyzUnavailableWithoutDatabase() = testApplication {
        application { module(settings, dataSource = null) }
        val response = client.get("/readyz")
        assertEquals(HttpStatusCode.ServiceUnavailable, response.status)
        assertEquals("""{"ok":false}""", response.bodyAsText())
    }

    @Test
    fun echoesRequestId() = testApplication {
        application { module(settings, dataSource = null) }
        val response = client.get("/healthz") {
            header("X-Request-ID", "req-1")
        }
        assertEquals("req-1", response.headers["X-Request-ID"])
    }
}
