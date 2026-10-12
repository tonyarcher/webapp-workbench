package calsync.trakt

import calsync.persist.TraktCredentialEntity
import calsync.web.ApiException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

private const val DEVICE_CODE_JSON =
    """{"device_code":"dc","user_code":"UC-1","expires_in":600,"interval":5}"""

private const val TOKEN_JSON =
    """{"access_token":"a","refresh_token":"r","expires_in":3600}"""

private class FakeTraktHttp(
    var reply: (method: String, path: String, body: String, headers: Map<String, String>) -> TraktReply,
) : TraktHttp {
    val calls = mutableListOf<Triple<String, String, Map<String, String>>>()
    override fun get(path: String, headers: Map<String, String>): TraktReply {
        calls.add(Triple("GET", path, headers))
        return reply("GET", path, "", headers)
    }

    override fun post(path: String, headers: Map<String, String>, body: String): TraktReply {
        calls.add(Triple("POST", path, headers))
        return reply("POST", path, body, headers)
    }
}

@ExtendWith(MockitoExtension::class)
class TraktServiceTest {

    @Mock
    lateinit var vault: TraktVaultService

    private val uid: UUID = UUID.randomUUID()

    private fun service(fake: FakeTraktHttp): TraktService = TraktService(vault, fake)

    private fun creds(
        clientId: String = "cid",
        clientSecret: String = "sec",
        access: String? = "tok",
        refresh: String? = "ref",
    ): TraktCredentialEntity = TraktCredentialEntity(
        userId = uid,
        clientId = clientId,
        clientSecret = clientSecret,
        accessToken = access,
        refreshToken = refresh,
        expiresAt = Instant.parse("2026-10-12T00:00:00Z"),
    )

    private fun stubVault(row: TraktCredentialEntity?) {
        if (row == null) {
            whenever(vault.required(eq(uid))).thenThrow(
                ApiException(HttpStatus.BAD_REQUEST, "trakt not configured"),
            )
        } else {
            whenever(vault.required(eq(uid))).thenReturn(row)
        }
    }

    @Test
    fun deviceCodeRequiresVault() {
        stubVault(null)
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> TraktReply(200, "{}") }).deviceCode(uid)
        }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
    }

    @Test
    fun deviceCodeMapsTraktFields() {
        stubVault(creds(access = null, refresh = null))
        val fake = FakeTraktHttp { _, _, _, _ -> TraktReply(200, DEVICE_CODE_JSON) }
        val code = service(fake).deviceCode(uid)
        assertEquals("dc", code.deviceCode)
        assertEquals("UC-1", code.userCode)
        assertEquals(600, code.expiresIn)
    }

    @Test
    fun deviceCodeTraktFailureIs502() {
        stubVault(creds(access = null, refresh = null))
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> TraktReply(500, "{}") }).deviceCode(uid)
        }
        assertEquals(HttpStatus.BAD_GATEWAY, err.status)
    }

    @Test
    fun deviceCodeUnreadableBodyIs502() {
        stubVault(creds(access = null, refresh = null))
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> TraktReply(200, "nope{{{") }).deviceCode(uid)
        }
        assertEquals(HttpStatus.BAD_GATEWAY, err.status)
    }

    @Test
    fun pollBlankCodeIs400() {
        stubVault(creds(access = null, refresh = null))
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> TraktReply(200, "{}") }).pollDeviceToken(uid, "  ")
        }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
    }

    @Test
    fun pollTokenStoresAndAuthorizes() {
        stubVault(creds(access = null, refresh = null))
        val fake = FakeTraktHttp { _, _, _, _ -> TraktReply(200, TOKEN_JSON) }
        whenever(vault.storeTokens(any(), any())).thenReturn(Instant.parse("2026-10-12T01:00:00Z"))
        val result = service(fake).pollDeviceToken(uid, "dc")
        assertTrue(result.authorized)
        assertEquals(Instant.parse("2026-10-12T01:00:00Z"), result.expiresAt)
        verify(vault).storeTokens(any(), any())
    }

    @Test
    fun pollPendingStaysUnauthorized() {
        stubVault(creds(access = null, refresh = null))
        val fake = FakeTraktHttp { _, _, _, _ -> TraktReply(400, """{"error":"authorization_pending"}""") }
        val result = service(fake).pollDeviceToken(uid, "dc")
        assertFalse(result.authorized)
        assertNull(result.expiresAt)
        verify(vault, never()).storeTokens(any(), any())
    }

    @Test
    fun pollDeniedIs400() {
        stubVault(creds(access = null, refresh = null))
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> TraktReply(400, """{"error":"access_denied"}""") })
                .pollDeviceToken(uid, "dc")
        }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
    }

    @Test
    fun pollExpiredIs400() {
        stubVault(creds(access = null, refresh = null))
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> TraktReply(400, """{"error":"expired_token"}""") })
                .pollDeviceToken(uid, "dc")
        }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
    }

    @Test
    fun refreshWithoutTokensIs400() {
        stubVault(creds(access = null, refresh = null))
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> TraktReply(200, "{}") }).refreshTokens(uid)
        }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
    }

    @Test
    fun refreshStoresNewTokens() {
        stubVault(creds())
        val fake = FakeTraktHttp { _, _, _, _ ->
            TraktReply(200, """{"access_token":"a2","refresh_token":"r2","expires_in":7200}""")
        }
        val expected = Instant.now().plusSeconds(7_200)
        whenever(vault.storeTokens(any(), any())).thenReturn(expected)
        assertEquals(expected, service(fake).refreshTokens(uid))
        verify(vault).storeTokens(any(), any())
    }

    @Test
    fun refreshRejectedDropsDeadTokens() {
        stubVault(creds())
        // The real vault always throws from dropTokens; the mock must be
        // told, or execution falls through to the 502 line below it.
        whenever(vault.dropTokens(any())).thenAnswer {
            throw ApiException(HttpStatus.BAD_REQUEST, "trakt authorization expired")
        }
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> TraktReply(400, """{"error":"invalid_grant"}""") }).refreshTokens(uid)
        }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
        verify(vault).dropTokens(any())
    }

    @Test
    fun refreshUnreadableBodyIs502() {
        stubVault(creds())
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> TraktReply(200, "nope{{{") }).refreshTokens(uid)
        }
        assertEquals(HttpStatus.BAD_GATEWAY, err.status)
        verify(vault, never()).storeTokens(any(), any())
    }

    @Test
    fun refreshTransportFailureKeepsTokens() {
        stubVault(creds())
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> TraktReply(503, "busy") }).refreshTokens(uid)
        }
        assertEquals(HttpStatus.BAD_GATEWAY, err.status)
        verify(vault, never()).storeTokens(any(), any())
    }

    @Test
    fun deviceCodeTransportIs502() {
        stubVault(creds(access = null, refresh = null))
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> throw TraktTransportException("down") }).deviceCode(uid)
        }
        assertEquals(HttpStatus.BAD_GATEWAY, err.status)
    }

    @Test
    fun pollTransportIs502() {
        stubVault(creds(access = null, refresh = null))
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> throw TraktTransportException("down") })
                .pollDeviceToken(uid, "dc")
        }
        assertEquals(HttpStatus.BAD_GATEWAY, err.status)
    }

    @Test
    fun proxiedGetTransportIs502() {
        stubVault(creds())
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> throw TraktTransportException("down") }).proxiedGet(uid, "/x")
        }
        assertEquals(HttpStatus.BAD_GATEWAY, err.status)
    }

    @Test
    fun proxiedGetSendsVaultToken() {
        stubVault(creds())
        val fake = FakeTraktHttp { _, _, _, _ -> TraktReply(200, "[1]") }
        assertEquals("[1]", service(fake).proxiedGet(uid, "/calendars/my/shows/2026-10-12/7"))
        val headers = fake.calls.single().third
        assertEquals("Bearer tok", headers["Authorization"])
        assertEquals("cid", headers["trakt-api-key"])
    }

    @Test
    fun proxiedGetRefreshesOnceOn401() {
        stubVault(creds())
        whenever(vault.token(eq(uid))).thenReturn("tok2")
        whenever(vault.storeTokens(any(), any())).thenReturn(Instant.parse("2026-10-12T01:00:00Z"))
        var gets = 0
        val fake = FakeTraktHttp { method, path, _, _ ->
            if (method == "GET" && path == "/x") {
                gets += 1
                if (gets == 1) TraktReply(401, "{}") else TraktReply(200, "[2]")
            } else {
                TraktReply(200, """{"access_token":"a2","refresh_token":"r2","expires_in":3600}""")
            }
        }
        assertEquals("[2]", service(fake).proxiedGet(uid, "/x"))
        assertEquals(2, fake.calls.count { it.first == "GET" })
    }

    @Test
    fun proxiedGetSecond401Expires() {
        stubVault(creds())
        whenever(vault.token(eq(uid))).thenReturn("tok2")
        whenever(vault.storeTokens(any(), any())).thenReturn(Instant.parse("2026-10-12T01:00:00Z"))
        val fake = FakeTraktHttp { method, _, _, _ ->
            if (method == "GET") {
                TraktReply(401, "{}")
            } else {
                TraktReply(200, """{"access_token":"a2","refresh_token":"r2","expires_in":3600}""")
            }
        }
        val err = assertFailsWith<ApiException> { service(fake).proxiedGet(uid, "/x") }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
    }

    @Test
    fun proxiedGetRateLimited() {
        stubVault(creds())
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> TraktReply(429, "{}") }).proxiedGet(uid, "/x")
        }
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, err.status)
    }

    @Test
    fun proxiedGetServerErrorIs502() {
        stubVault(creds())
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> TraktReply(500, "{}") }).proxiedGet(uid, "/x")
        }
        assertEquals(HttpStatus.BAD_GATEWAY, err.status)
    }

    @Test
    fun proxiedGetWithoutTokensIs400() {
        stubVault(creds(access = null, refresh = null))
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> TraktReply(200, "[]") }).proxiedGet(uid, "/x")
        }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
    }

    @Test
    fun proxiedGetRefreshOnlyNullIs400() {
        stubVault(creds(access = "tok", refresh = null))
        val err = assertFailsWith<ApiException> {
            service(FakeTraktHttp { _, _, _, _ -> TraktReply(200, "[]") }).proxiedGet(uid, "/x")
        }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
    }

    @Test
    fun defaultHttpDefersToVaultFirst() {
        // The default JdkTraktHttp builds lazily; a vault miss throws before
        // any socket exists, covering the default-argument line.
        stubVault(null)
        val err = assertFailsWith<ApiException> { TraktService(vault).deviceCode(uid) }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
    }
}
