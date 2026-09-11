package userapi.accounts

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import userapi.crypto.JwtSigner
import userapi.domain.OAuthClient
import userapi.domain.pkceS256
import userapi.domain.sha256Hex
import userapi.http.FakeOAuthStore

class OAuthServiceTest {
    private val clock = Clock.fixed(Instant.parse("2026-09-11T17:00:00Z"), ZoneOffset.UTC)
    private val redirect = "http://localhost/fitness/"
    private val verifier = "v".repeat(43)
    private val userId = UUID.fromString("11111111-1111-1111-1111-111111111111")

    @Test
    fun refreshRotatesAndReuseKillsFamily() {
        val store = FakeOAuthStore()
        val oauth = OAuthService(
            store = store,
            clients = listOf(OAuthClient("fitness", setOf(redirect))),
            signer = JwtSigner(store, "http://localhost/user-api"),
            clock = clock,
        )
        val code = "c".repeat(32)
        store.insertAuthCode(
            sha256Hex(code),
            userId,
            "fitness",
            redirect,
            pkceS256(verifier),
            clock.instant().plusSeconds(600),
        )
        val first = oauth.exchangeCode(code, "fitness", redirect, verifier) { "alice" }
        assertNotNull(first)
        val second = oauth.rotateRefresh(first.refreshToken) { "alice" }
        assertNotNull(second)
        assertNull(oauth.rotateRefresh(first.refreshToken) { "alice" })
        assertNull(oauth.rotateRefresh(second.refreshToken) { "alice" })
    }
}
