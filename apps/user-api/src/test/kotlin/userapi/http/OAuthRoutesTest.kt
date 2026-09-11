package userapi.http

import io.ktor.client.HttpClient
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.cookies.HttpCookies
import io.ktor.client.request.forms.submitForm
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.parametersOf
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
import userapi.accounts.OAuthService
import userapi.crypto.JwtSigner
import userapi.domain.OAuthClient
import userapi.domain.pkceS256
import userapi.module

class OAuthRoutesTest {
    private val settings = Settings(3000, "", "error", "user-api", cookieSecure = false)
    private val clock = Clock.fixed(Instant.parse("2026-09-11T17:00:00Z"), ZoneOffset.UTC)
    private val redirect = "http://localhost/fitness/"
    private val verifier = "v".repeat(43)

    @Test
    fun authorizeTokenAndRejectReplay() = testApplication {
        application { module(settings, dataSource = null, accounts = services()) }
        val client = apiClient()
        val csrf = csrfToken(client)
        client.post("/v1/register") {
            header(CSRF_HEADER, csrf)
            contentType(ContentType.Application.Json)
            setBody(PasswordBody("alice", "twelvechars!!"))
        }
        val code = authorize(client)
        val token = exchange(client, code)
        assertTrue(token.contains("access_token"))
        val replay = exchange(client, code)
        assertTrue(replay.contains("invalid_grant"))
    }

    private suspend fun authorize(client: HttpClient): String {
        val challenge = pkceS256(verifier)
        val response = client.get(
            "/oauth/authorize?response_type=code&client_id=fitness&redirect_uri=$redirect" +
                "&code_challenge=$challenge&code_challenge_method=S256&state=xyz",
        )
        val loc = response.headers["Location"].orEmpty()
        assertTrue(loc.contains("code="))
        return loc.substringAfter("code=").substringBefore("&")
    }

    private suspend fun exchange(client: HttpClient, code: String): String {
        val response = client.submitForm(
            url = "/oauth/token",
            formParameters = parametersOf(
                "grant_type" to listOf("authorization_code"),
                "code" to listOf(code),
                "redirect_uri" to listOf(redirect),
                "client_id" to listOf("fitness"),
                "code_verifier" to listOf(verifier),
            ),
        )
        return response.bodyAsText()
    }

    private fun services(): AccountServices {
        val oauthStore = FakeOAuthStore()
        val oauth = OAuthService(
            store = oauthStore,
            clients = listOf(OAuthClient("fitness", setOf(redirect))),
            signer = JwtSigner(oauthStore, "http://localhost/user-api"),
            clock = clock,
        )
        return AccountServices(
            store = FakeAccountStore(),
            hasher = PlainHasher(),
            limiter = RateLimiter(limit = 100, windowMs = 60_000L),
            clock = clock,
            oauth = oauth,
        )
    }

    private fun ApplicationTestBuilder.apiClient(): HttpClient = createClient {
        followRedirects = false
        install(HttpCookies)
        install(ContentNegotiation) { json() }
    }

    private suspend fun csrfToken(client: HttpClient): String {
        val response = client.get("/v1/csrf")
        val obj = Json.parseToJsonElement(response.bodyAsText()).jsonObject
        return obj["csrf"]?.jsonPrimitive?.content ?: error("missing csrf")
    }
}
