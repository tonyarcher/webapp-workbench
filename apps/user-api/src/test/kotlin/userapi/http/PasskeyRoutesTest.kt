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
import userapi.accounts.PasskeyService
import userapi.accounts.buildRelyingParty
import userapi.module

class PasskeyRoutesTest {
    private val settings = Settings(3000, "", "error", "user-api", cookieSecure = false)
    private val clock = Clock.fixed(Instant.parse("2026-09-11T17:00:00Z"), ZoneOffset.UTC)

    @Test
    fun registerBeginNeedsSessionAndReturnsOptions() = testApplication {
        application { module(settings, dataSource = null, accounts = services()) }
        val client = apiClient()
        val csrf = csrfToken(client)
        val anon = client.post("/v1/passkey/register/begin") { header(CSRF_HEADER, csrf) }
        assertEquals(HttpStatusCode.Unauthorized, anon.status)
        client.post("/v1/register") {
            header(CSRF_HEADER, csrf)
            contentType(ContentType.Application.Json)
            setBody(PasswordBody("alice", "twelvechars!!"))
        }
        val begin = client.post("/v1/passkey/register/begin") { header(CSRF_HEADER, csrf) }
        assertEquals(HttpStatusCode.OK, begin.status)
        assertTrue(begin.bodyAsText().contains("publicKey"))
        val loginBegin = client.post("/v1/passkey/login/begin") { header(CSRF_HEADER, csrf) }
        assertEquals(HttpStatusCode.OK, loginBegin.status)
        assertTrue(loginBegin.bodyAsText().contains("publicKey"))
    }

    private fun services(): AccountServices {
        val users = FakeAccountStore()
        val passkeys = FakePasskeyStore()
        val svc = PasskeyService(buildRelyingParty(settings, passkeys), passkeys, FakeChallengeStore(), clock)
        return AccountServices(
            store = users,
            hasher = PlainHasher(),
            limiter = RateLimiter(limit = 100, windowMs = 60_000L),
            clock = clock,
            passkeys = svc,
        )
    }

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
