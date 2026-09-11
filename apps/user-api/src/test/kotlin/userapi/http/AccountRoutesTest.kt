package userapi.http

import io.ktor.client.HttpClient
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
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
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

class AccountRoutesTest {
    private val settings = Settings(3000, "", "error", "user-api", cookieSecure = false)
    private val clock = Clock.fixed(Instant.parse("2026-09-11T17:00:00Z"), ZoneOffset.UTC)

    @Test
    fun registerLoginMeLogout() = testApplication {
        val accounts = services()
        application { module(settings, dataSource = null, accounts = accounts) }
        val client = apiClient()
        val csrf = csrfToken(client)
        val created = client.post("/v1/register") {
            header(CSRF_HEADER, csrf)
            contentType(ContentType.Application.Json)
            setBody(PasswordBody("alice", "twelvechars!!"))
        }
        assertEquals(HttpStatusCode.Created, created.status)
        val me = client.get("/v1/me")
        assertEquals(HttpStatusCode.OK, me.status)
        assertTrue(me.bodyAsText().contains("alice"))
        val loggedOut = client.post("/v1/logout") {
            header(CSRF_HEADER, csrf)
        }
        assertEquals(HttpStatusCode.OK, loggedOut.status)
        assertEquals(HttpStatusCode.Unauthorized, client.get("/v1/me").status)
        val login = client.post("/v1/login") {
            header(CSRF_HEADER, csrf)
            contentType(ContentType.Application.Json)
            setBody(PasswordBody("alice", "twelvechars!!"))
        }
        assertEquals(HttpStatusCode.OK, login.status)
        assertEquals(HttpStatusCode.OK, client.get("/v1/me").status)
    }

    @Test
    fun csrfRequiredAndBadPassword() = testApplication {
        val accounts = services()
        application { module(settings, dataSource = null, accounts = accounts) }
        val client = apiClient()
        val csrf = csrfToken(client)
        client.post("/v1/register") {
            header(CSRF_HEADER, csrf)
            contentType(ContentType.Application.Json)
            setBody(PasswordBody("alice", "twelvechars!!"))
        }
        val missing = client.post("/v1/login") {
            contentType(ContentType.Application.Json)
            setBody(PasswordBody("alice", "twelvechars!!"))
        }
        assertEquals(HttpStatusCode.Forbidden, missing.status)
        val wrong = client.post("/v1/login") {
            header(CSRF_HEADER, csrf)
            contentType(ContentType.Application.Json)
            setBody(PasswordBody("alice", "wrong-password-long"))
        }
        assertEquals(HttpStatusCode.Unauthorized, wrong.status)
        assertTrue(wrong.bodyAsText().contains("invalid credentials"))
    }

    @Test
    fun duplicateUsernameConflict() = testApplication {
        val accounts = services()
        application { module(settings, dataSource = null, accounts = accounts) }
        val client = apiClient()
        val csrf = csrfToken(client)
        client.post("/v1/register") {
            header(CSRF_HEADER, csrf)
            contentType(ContentType.Application.Json)
            setBody(PasswordBody("alice", "twelvechars!!"))
        }
        val dup = client.post("/v1/register") {
            header(CSRF_HEADER, csrf)
            contentType(ContentType.Application.Json)
            setBody(PasswordBody("alice", "otherpassword1"))
        }
        assertEquals(HttpStatusCode.Conflict, dup.status)
    }

    private fun services(): AccountServices = AccountServices(
        store = FakeAccountStore(),
        hasher = PlainHasher(),
        limiter = RateLimiter(limit = 100, windowMs = 60_000L),
        clock = clock,
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
