package userapi.accounts

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import userapi.Settings

class PasskeyServiceBranchTest {
    private val clock = Clock.fixed(Instant.parse("2026-09-11T17:00:00Z"), ZoneOffset.UTC)
    private val settings = Settings(3000, "", "error", "user-api", cookieSecure = false)
    private val userId = UUID.randomUUID()

    private fun service(store: PasskeyStore = mock(), challenges: WebauthnChallengeStore = mock()): PasskeyService {
        whenever(store.ensureUserHandle(userId)).thenReturn(byteArrayOf(1, 2, 3))
        return PasskeyService(buildRelyingParty(settings, store), store, challenges, clock)
    }

    @Test
    fun startsRegisterAndLogin() {
        val svc = service()
        val (regId, regJson) = svc.startRegister(userId, "alice")
        assertTrue(regId.isNotEmpty())
        assertTrue(regJson.contains("challenge"))
        val (loginId, loginJson) = svc.startLogin()
        assertTrue(loginId.isNotEmpty())
        assertTrue(loginJson.contains("challenge"))
        assertTrue(regId != loginId)
    }

    @Test
    fun finishExpiredChallenge() {
        val challenges = mock<WebauthnChallengeStore>()
        whenever(challenges.takeChallenge("bad", clock.instant())).thenReturn(null)
        val svc = service(challenges = challenges)
        assertFailsWith<IllegalStateException> { svc.finishRegister("bad", "{}", userId) }
        assertFailsWith<IllegalStateException> { svc.finishLogin("bad", "{}") }
    }

    @Test
    fun finishWrongKind() {
        val challenges = mock<WebauthnChallengeStore>()
        whenever(challenges.takeChallenge("id", clock.instant())).thenReturn(
            WebauthnChallenge("id", "login", userId, "{}"),
        )
        val svc = service(challenges = challenges)
        assertFailsWith<IllegalArgumentException> { svc.finishRegister("id", "{}", userId) }
    }

    @Test
    fun finishBadResponse() {
        val challenges = mock<WebauthnChallengeStore>()
        val put = org.mockito.kotlin.argumentCaptor<WebauthnChallenge>()
        val svc = service(challenges = challenges)
        val (regId, _) = svc.startRegister(userId, "alice")
        org.mockito.kotlin.verify(challenges).putChallenge(put.capture(), org.mockito.kotlin.any())
        whenever(challenges.takeChallenge(regId, clock.instant())).thenReturn(put.firstValue)
        assertFailsWith<Exception> { svc.finishRegister(regId, """{"not":"valid"}""", userId) }
        val (loginId, _) = svc.startLogin()
        whenever(challenges.takeChallenge(loginId, clock.instant())).thenReturn(
            WebauthnChallenge(loginId, "login", null, put.firstValue.payload),
        )
        assertFailsWith<Exception> { svc.finishLogin(loginId, """{"not":"valid"}""") }
    }

    @Test
    fun buildsRelyingParty() {
        val rp = buildRelyingParty(settings, mock())
        assertEquals("localhost", rp.identity.id)
    }
}
