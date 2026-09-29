package userapi.accounts

import org.junit.jupiter.api.Test
import userapi.crypto.JwtSigner
import userapi.domain.pkceS256
import userapi.domain.sha256Hex
import userapi.http.FakeOAuthStore
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/**
 * The auth code is consumed only when every presented field matches, and that
 * ordering is the whole contract.
 *
 * Go's x/oauth2 sends client_id in the Authorization header on its first
 * exchange, so it arrives absent from the form; user-api then retries with it in
 * the body. When the take deleted the code before checking the client, the first
 * attempt destroyed it and the corrected retry found nothing, so every
 * authorization_code grant from a Go client failed twice. Grafana is exactly that
 * client, and the log viewer could not sign in.
 *
 * FakeOAuthStore rather than a mock: it is a real implementation of the store
 * contract, so these cases assert the behaviour the conditional DELETE must have.
 */
class OAuthCodeExchangeTest {
    private val clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC)
    private val verifier = "a".repeat(43)
    private val challenge = pkceS256(verifier)
    private val code = "c".repeat(32)
    private val userId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    private val clientId = "grafana"
    private val redirect = "http://host/logs/login/generic_oauth"

    private val store = FakeOAuthStore()
    private val oauth = OAuthService(
        store = store,
        signer = JwtSigner(store, "http://localhost/user-api"),
        clock = clock,
    )

    private fun issue(challengeFor: String = challenge, ttlSeconds: Long = 600) {
        store.insertAuthCode(
            sha256Hex(code),
            userId,
            clientId,
            redirect,
            challengeFor,
            clock.instant().plusSeconds(ttlSeconds),
        )
    }

    @Test
    fun aCorrectExchangeSucceeds() {
        issue()
        assertNotNull(oauth.exchangeCode(code, clientId, redirect, verifier) { "alice" })
    }

    @Test
    fun aWrongVerifierIsRejected() {
        issue()
        assertNull(oauth.exchangeCode(code, clientId, redirect, "b".repeat(43)) { "alice" })
    }

    @Test
    fun aWrongRedirectIsRejected() {
        issue()
        assertNull(oauth.exchangeCode(code, clientId, "http://host/other", verifier) { "alice" })
    }

    @Test
    fun aMissingClientIdIsRejected() {
        issue()
        assertNull(oauth.exchangeCode(code, "", redirect, verifier) { "alice" })
    }

    @Test
    fun aVerifierShorterThanRfc7636IsRejected() {
        issue()
        assertNull(oauth.exchangeCode(code, clientId, redirect, "tooshort") { "alice" })
    }

    @Test
    fun anExpiredCodeIsRejected() {
        issue(ttlSeconds = -60)
        assertNull(oauth.exchangeCode(code, clientId, redirect, verifier) { "alice" })
    }

    @Test
    fun anUnknownUserIsRejected() {
        issue()
        assertNull(oauth.exchangeCode(code, clientId, redirect, verifier) { null })
    }

    /** The regression. The retry must still find the code the probe left behind. */
    @Test
    fun theCorrectedRetryStillRedeemsTheCode() {
        issue()
        val probe = oauth.exchangeCode(code, "", redirect, verifier) { "alice" }
        assertNull(probe, "the Basic-auth probe, which omits client_id, must fail")

        val retry = oauth.exchangeCode(code, clientId, redirect, verifier) { "alice" }
        assertNotNull(retry, "the retry must still find the code alive")
    }

    @Test
    fun aRejectedVerifierAlsoLeavesTheCodeForTheRealAttempt() {
        issue()
        assertNull(oauth.exchangeCode(code, clientId, redirect, "b".repeat(43)) { "alice" })
        assertNotNull(oauth.exchangeCode(code, clientId, redirect, verifier) { "alice" })
    }

    @Test
    fun aRejectedRedirectAlsoLeavesTheCodeForTheRealAttempt() {
        issue()
        assertNull(oauth.exchangeCode(code, clientId, "http://host/other", verifier) { "alice" })
        assertNotNull(oauth.exchangeCode(code, clientId, redirect, verifier) { "alice" })
    }

    @Test
    fun aCodeIsSingleUseOnceItHasSucceeded() {
        issue()
        assertNotNull(oauth.exchangeCode(code, clientId, redirect, verifier) { "alice" })
        assertNull(
            oauth.exchangeCode(code, clientId, redirect, verifier) { "alice" },
            "a redeemed code must not work twice",
        )
    }
}
