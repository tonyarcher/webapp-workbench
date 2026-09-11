package userapi.http

import io.ktor.client.HttpClient
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.cookies.HttpCookies
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.module

class TotpRoutesTest {
    private val settings = Settings(3000, "", "error", "user-api", cookieSecure = false)
    private val clock = Clock.fixed(Instant.parse("2026-09-11T17:00:00Z"), ZoneOffset.UTC)

    @Test
    fun enrollThenLoginRequiresCode() = testApplication {
        application { module(settings, dataSource = null, accounts = services()) }
        val client = apiClient()
        val csrf = csrfToken(client)
        enrollAlice(client, csrf)
        passwordLoginNeedsTotp(client, csrf)
        finishTotp(client, csrf)
    }

    private suspend fun enrollAlice(client: HttpClient, csrf: String) {
        jsonPost(client, csrf, "/v1/register", PasswordBody("alice", "twelvechars!!"))
        val begin = client.post("/v1/totp/begin") { header(CSRF_HEADER, csrf) }
        assertEquals(HttpStatusCode.OK, begin.status)
        val confirm = jsonPost(client, csrf, "/v1/totp/confirm", TotpConfirmBody("123456"))
        assertTrue(confirm.bodyAsText().contains("backupCodes"))
        client.post("/v1/logout") { header(CSRF_HEADER, csrf) }
    }

    private suspend fun passwordLoginNeedsTotp(client: HttpClient, csrf: String) {
        val login = jsonPost(client, csrf, "/v1/login", PasswordBody("alice", "twelvechars!!"))
        assertTrue(login.bodyAsText().contains("totpRequired"))
        assertEquals(HttpStatusCode.Unauthorized, client.get("/v1/me").status)
    }

    private suspend fun finishTotp(client: HttpClient, csrf: String) {
        val step = jsonPost(client, csrf, "/v1/login/totp", TotpConfirmBody("123456"))
        assertEquals(HttpStatusCode.OK, step.status)
        assertEquals(HttpStatusCode.OK, client.get("/v1/me").status)
    }

    private suspend fun jsonPost(client: HttpClient, csrf: String, path: String, body: Any) =
        client.post(path) {
            header(CSRF_HEADER, csrf)
            contentType(ContentType.Application.Json)
            setBody(body)
        }

    private fun services(): AccountServices = AccountServices(
        store = FakeAccountStore(),
        hasher = PlainHasher(),
        limiter = RateLimiter(limit = 100, windowMs = 60_000L),
        clock = clock,
        totpStore = FakeTotpStore(),
        totp = AcceptingTotp(),
    )

    private fun ApplicationTestBuilder.apiClient(): HttpClient = createClient {
        install(HttpCookies)
        install(ContentNegotiation) { json() }
    }

    private suspend fun csrfToken(client: HttpClient): String {
        val response = client.get("/v1/csrf")
        val obj = Json.parseToJsonElement(response.bodyAsText()).jsonObject
        return obj["csrf"]?.jsonPrimitive?.content ?: error("missing csrf")
    }
}
