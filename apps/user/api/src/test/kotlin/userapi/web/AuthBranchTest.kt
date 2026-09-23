package userapi.web

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import userapi.Settings
import userapi.accounts.AccountServices
import userapi.http.FakeAccountStore
import userapi.http.PlainHasher
import userapi.http.RateLimiter
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class AuthBranchTest {
    private val clock = Clock.fixed(Instant.parse("2026-09-11T17:00:00Z"), ZoneOffset.UTC)
    private val settings = Settings(3000, "", "error", "user-api", cookieSecure = false)

    private fun services(store: userapi.accounts.AccountStore? = FakeAccountStore()): AccountServices = AccountServices(
        store = store,
        hasher = PlainHasher(),
        limiter = RateLimiter(limit = 100, windowMs = 60_000L),
        clock = clock,
    )

    @Test
    fun sessions() {
        val request = mock<HttpServletRequest>()
        assertFailsWith<ApiException> { requestSession(request) }
        assertNull(peekSession(request))
        assertFailsWith<ApiException> { requireStore(services(null)) }
    }

    @Test
    fun clientIp() {
        val withHeader = mock<HttpServletRequest>()
        whenever(withHeader.getHeader("X-Real-IP")).thenReturn("  1.2.3.4  ")
        whenever(withHeader.remoteAddr).thenReturn("5.6.7.8")
        assertEquals("1.2.3.4", withHeader.clientIp())
        val withoutHeader = mock<HttpServletRequest>()
        whenever(withoutHeader.getHeader("X-Real-IP")).thenReturn(null)
        whenever(withoutHeader.remoteAddr).thenReturn("5.6.7.8")
        assertEquals("5.6.7.8", withoutHeader.clientIp())
    }

    @Test
    fun rateLimit() {
        val accounts = services()
        val request = mock<HttpServletRequest>()
        whenever(request.getHeader("X-Real-IP")).thenReturn(null)
        whenever(request.remoteAddr).thenReturn("9.9.9.9")
        checkRate(accounts, "k", request)
        val tight = AccountServices(
            store = FakeAccountStore(),
            hasher = PlainHasher(),
            limiter = RateLimiter(limit = 0, windowMs = 60_000L),
            clock = clock,
        )
        assertFailsWith<ApiException> { checkRate(tight, "k", request) }
    }

    @Test
    fun issueAndChallenge() {
        val store = FakeAccountStore()
        val accounts = services(store)
        val userId = UUID.randomUUID()
        store.createUser("bob", "hash")
        val user = store.findByUsername("bob")!!
        val response = mock<HttpServletResponse>()
        issueSession(response, settings, store, accounts, user.id)
        startTotpChallenge(response, settings, accounts, user.id)
        assertFailsWith<ApiException> { rejectAuth() }
        assertFailsWith<ApiException> { rejectRate() }
    }
}
