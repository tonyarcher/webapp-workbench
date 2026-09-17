package userapi.web

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.accounts.StoredSession
import userapi.http.FakeAccountStore
import userapi.http.FakeChallengeStore
import userapi.http.FakePasskeyStore
import userapi.http.PlainHasher
import userapi.http.RateLimiter
import userapi.accounts.PasskeyService
import userapi.accounts.buildRelyingParty

class PasskeyControllerBranchTest {
    private val clock = Clock.fixed(Instant.parse("2026-09-11T17:00:00Z"), ZoneOffset.UTC)
    private val settings = Settings(3000, "", "error", "user-api", cookieSecure = false)
    private val mapper = ObjectMapper()
    private val userId = UUID.randomUUID()

    private fun sessionRequest(): HttpServletRequest {
        val request = mock<HttpServletRequest>()
        whenever(request.getAttribute(SESSION_ATTR)).thenReturn(
            StoredSession(userId, "alice", clock.instant().plusSeconds(3600), false),
        )
        whenever(request.remoteAddr).thenReturn("127.0.0.1")
        return request
    }

    private fun services(): AccountServices {
        val store = FakePasskeyStore()
        val svc = PasskeyService(buildRelyingParty(settings, store), store, FakeChallengeStore(), clock)
        return AccountServices(
            store = FakeAccountStore(),
            hasher = PlainHasher(),
            limiter = RateLimiter(limit = 100, windowMs = 60_000L),
            clock = clock,
            passkeys = svc,
        )
    }

    @Test
    fun beginNeedsSession() {
        val controller = PasskeyController(services(), settings, mapper)
        assertFailsWith<ApiException> { controller.passkeyRegisterBegin(mock()) }
    }

    @Test
    fun missingServiceIs503() {
        val noPasskeys = AccountServices(
            store = FakeAccountStore(),
            hasher = PlainHasher(),
            limiter = RateLimiter(limit = 100, windowMs = 60_000L),
            clock = clock,
        )
        val controller = PasskeyController(noPasskeys, settings, mapper)
        assertFailsWith<ApiException> { controller.passkeyRegisterBegin(sessionRequest()) }
        assertFailsWith<ApiException> {
            controller.passkeyRegisterFinish(PasskeyFinishBody("x", mapper.createObjectNode()), sessionRequest())
        }
        assertFailsWith<ApiException> {
            controller.passkeyLoginFinish(PasskeyFinishBody("x", mapper.createObjectNode()), sessionRequest(), mock())
        }
    }

    @Test
    fun finishBadChallengeFails() {
        val controller = PasskeyController(services(), settings, mapper)
        assertFailsWith<Exception> {
            controller.passkeyRegisterFinish(PasskeyFinishBody("nope", mapper.createObjectNode()), sessionRequest())
        }
        assertFailsWith<Exception> {
            controller.passkeyLoginFinish(
                PasskeyFinishBody("nope", mapper.createObjectNode()),
                sessionRequest(),
                mock<HttpServletResponse>(),
            )
        }
    }

    @Test
    fun loginBeginRateLimited() {
        val tight = AccountServices(
            store = FakeAccountStore(),
            hasher = PlainHasher(),
            limiter = RateLimiter(limit = 0, windowMs = 60_000L),
            clock = clock,
            passkeys = PasskeyService(
                buildRelyingParty(settings, FakePasskeyStore()),
                FakePasskeyStore(),
                FakeChallengeStore(),
                clock,
            ),
        )
        val controller = PasskeyController(tight, settings, mapper)
        assertFailsWith<ApiException> { controller.passkeyLoginBegin(sessionRequest()) }
    }
}
