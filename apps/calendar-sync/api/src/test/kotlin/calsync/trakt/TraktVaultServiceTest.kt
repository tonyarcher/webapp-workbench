package calsync.trakt

import calsync.persist.TraktCredentialEntity
import calsync.persist.TraktCredentialRepo
import calsync.web.ApiException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import java.time.Instant
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@ExtendWith(MockitoExtension::class)
class TraktVaultServiceTest {

    @Mock
    lateinit var vault: TraktCredentialRepo

    private val uid: UUID = UUID.randomUUID()

    private fun service(): TraktVaultService = TraktVaultService(vault)

    private fun savingService(): TraktVaultService {
        whenever(vault.save(any<TraktCredentialEntity>())).thenAnswer { it.getArgument<TraktCredentialEntity>(0) }
        return TraktVaultService(vault)
    }

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

    @Test
    fun saveRejectsBlankCredentials() {
        val err = assertFailsWith<ApiException> { service().saveCredentials(uid, "", "sec") }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
        val second = assertFailsWith<ApiException> { service().saveCredentials(uid, "cid", "  ") }
        assertEquals(HttpStatus.BAD_REQUEST, second.status)
        verify(vault, never()).save(any())
    }

    @Test
    fun saveTrimsAndClearsOldTokens() {
        whenever(vault.findById(eq(uid))).thenReturn(Optional.of(creds()))
        savingService().saveCredentials(uid, "  new  ", "sec")
        val captor = argumentCaptor<TraktCredentialEntity>()
        verify(vault).save(captor.capture())
        assertEquals("new", captor.firstValue.clientId)
        assertNull(captor.firstValue.accessToken)
        assertNull(captor.firstValue.refreshToken)
        assertNull(captor.firstValue.expiresAt)
    }

    @Test
    fun saveWithoutRowCreatesOne() {
        whenever(vault.findById(eq(uid))).thenReturn(Optional.empty())
        savingService().saveCredentials(uid, "cid", "sec")
        val captor = argumentCaptor<TraktCredentialEntity>()
        verify(vault).save(captor.capture())
        assertEquals(uid, captor.firstValue.userId)
    }

    @Test
    fun statusMissingIsUnconfigured() {
        whenever(vault.findById(eq(uid))).thenReturn(Optional.empty())
        val status = service().status(uid)
        assertFalse(status.configured)
        assertFalse(status.authorized)
        assertNull(status.expiresAt)
    }

    @Test
    fun statusBlankSecretsIsUnconfigured() {
        whenever(vault.findById(eq(uid))).thenReturn(Optional.of(creds(clientId = "  ")))
        assertFalse(service().status(uid).configured)
    }

    @Test
    fun statusTokensIsAuthorized() {
        whenever(vault.findById(eq(uid))).thenReturn(Optional.of(creds()))
        val status = service().status(uid)
        assertTrue(status.configured)
        assertTrue(status.authorized)
        assertEquals(Instant.parse("2026-10-12T00:00:00Z"), status.expiresAt)
    }

    @Test
    fun statusWithoutTokensIsConfiguredOnly() {
        whenever(vault.findById(eq(uid))).thenReturn(Optional.of(creds(access = null, refresh = null)))
        val status = service().status(uid)
        assertTrue(status.configured)
        assertFalse(status.authorized)
    }

    @Test
    fun statusHalfTokensIsConfiguredOnly() {
        whenever(vault.findById(eq(uid))).thenReturn(Optional.of(creds(access = "tok", refresh = null)))
        val status = service().status(uid)
        assertTrue(status.configured)
        assertFalse(status.authorized)
    }

    @Test
    fun clearDeletesOnlyWhenPresent() {
        whenever(vault.existsById(eq(uid))).thenReturn(true)
        service().clear(uid)
        verify(vault).deleteById(eq(uid))
    }

    @Test
    fun clearMissingIsQuiet() {
        whenever(vault.existsById(eq(uid))).thenReturn(false)
        service().clear(uid)
        verify(vault, never()).deleteById(any())
    }

    @Test
    fun requiredReturnsRow() {
        val row = creds()
        whenever(vault.findById(eq(uid))).thenReturn(Optional.of(row))
        assertEquals(row, service().required(uid))
    }

    @Test
    fun requiredMissingIs400() {
        whenever(vault.findById(eq(uid))).thenReturn(Optional.empty())
        val err = assertFailsWith<ApiException> { service().required(uid) }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
    }

    @Test
    fun requiredBlankSecretsIs400() {
        whenever(vault.findById(eq(uid))).thenReturn(Optional.of(creds(clientSecret = "")))
        val err = assertFailsWith<ApiException> { service().required(uid) }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
    }

    @Test
    fun requiredBlankClientIdIs400() {
        whenever(vault.findById(eq(uid))).thenReturn(Optional.of(creds(clientId = " ")))
        val err = assertFailsWith<ApiException> { service().required(uid) }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
    }

    @Test
    fun storeTokensPersists() {
        val row = creds(access = null, refresh = null)
        val at = savingService().storeTokens(row, TraktTokens("a", "r", 3_600))
        assertEquals("a", row.accessToken)
        assertEquals("r", row.refreshToken)
        assertEquals(at, row.expiresAt)
        verify(vault).save(row)
    }

    @Test
    fun dropTokensClearsAndThrows() {
        val row = creds()
        val err = assertFailsWith<ApiException> { savingService().dropTokens(row) }
        assertEquals(HttpStatus.BAD_REQUEST, err.status)
        assertNull(row.accessToken)
        assertNull(row.refreshToken)
        assertNull(row.expiresAt)
        verify(vault).save(row)
    }

    @Test
    fun tokenReadsVault() {
        whenever(vault.findById(eq(uid))).thenReturn(Optional.of(creds()))
        assertEquals("tok", service().token(uid))
    }

    @Test
    fun tokenMissingIsEmpty() {
        whenever(vault.findById(eq(uid))).thenReturn(Optional.empty())
        assertEquals("", service().token(uid))
    }
}
