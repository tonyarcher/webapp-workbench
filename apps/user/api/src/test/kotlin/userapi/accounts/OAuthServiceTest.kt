package userapi.accounts

import userapi.crypto.JwtSigner
import userapi.domain.OAuthClient
import userapi.domain.pkceS256
import userapi.domain.sha256Hex
import userapi.http.FakeOAuthStore
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class OAuthServiceTest {
    private val clock = Clock.fixed(Instant.parse("2026-09-11T17:00:00Z"), ZoneOffset.UTC)
    private val redirect = "http://localhost/fitness/"
    private val verifier = "v".repeat(43)
    private val userId = UUID.fromString("11111111-1111-1111-1111-111111111111")

    @Test
    fun refreshRotatesAndReuseKillsFamily() {
        val store = FakeOAuthStore()
        store.putClient(OAuthClient("fitness", setOf(redirect)))
        val oauth = OAuthService(
            store = store,
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

    @Test
    fun rotateUnknownUser() {
        val store = FakeOAuthStore()
        store.putClient(OAuthClient("fitness", setOf(redirect)))
        val oauth = OAuthService(
            store = store,
            signer = JwtSigner(store, "http://localhost/user-api"),
            clock = clock,
        )
        val code = "e".repeat(32)
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
        assertNull(oauth.rotateRefresh(first.refreshToken) { null })
    }

    @Test
    fun exchangeRejectsMismatch() {
        val store = FakeOAuthStore()
        store.putClient(OAuthClient("fitness", setOf(redirect)))
        val oauth = OAuthService(
            store = store,
            signer = JwtSigner(store, "http://localhost/user-api"),
            clock = clock,
        )
        assertNull(oauth.exchangeCode("missing", "fitness", redirect, verifier) { "alice" })
        fun freshCode(tag: String): String {
            val c = tag.repeat(32).take(32)
            store.insertAuthCode(
                sha256Hex(c),
                userId,
                "fitness",
                redirect,
                pkceS256(verifier),
                clock.instant().plusSeconds(600),
            )
            return c
        }
        assertNull(oauth.exchangeCode(freshCode("d"), "other", redirect, verifier) { "alice" })
        assertNull(oauth.exchangeCode(freshCode("e"), "fitness", "http://localhost/other/", verifier) { "alice" })
        assertNull(
            oauth.exchangeCode(freshCode("f"), "fitness", redirect, "wrong-verifier-value-0123456789") { "alice" },
        )
        assertNull(oauth.exchangeCode(freshCode("g"), "fitness", redirect, verifier) { null })
        val good = freshCode("h")
        assertNotNull(oauth.exchangeCode(good, "fitness", redirect, verifier) { "alice" })
        assertNull(oauth.exchangeCode(good, "fitness", redirect, verifier) { "alice" })
    }

    @Test
    fun redirectChecks() {
        val store = FakeOAuthStore()
        store.putClient(OAuthClient("fitness", setOf(redirect)))
        val oauth = OAuthService(
            store = store,
            signer = JwtSigner(store, "http://localhost/user-api"),
            clock = clock,
        )
        assertNull(oauth.client("ghost"))
        assertTrue(oauth.allowedRedirect("fitness", redirect))
        assertFalse(oauth.allowedRedirect("fitness", "http://evil.example/"))
        assertFalse(oauth.allowedRedirect("ghost", redirect))
    }
}
