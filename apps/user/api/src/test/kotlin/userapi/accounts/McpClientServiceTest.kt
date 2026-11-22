package userapi.accounts
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import userapi.Settings
import userapi.crypto.JwtSigner
import userapi.persist.McpClientEntity
import userapi.persist.McpClientRepo
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.Optional
import java.util.UUID

class McpClientServiceTest {
    private val repo: McpClientRepo = mock()
    private val signer: JwtSigner = mock()
    private val settings = Settings(
        port = 3000,
        databaseUrl = "",
        logLevel = "info",
        service = "user-api",
        cookieSecure = false,
        rpId = "example.com",
        origins = setOf("https://example.com"),
        issuer = "https://example.com/user-api",
        publicBase = "https://example.com/user-api",
        mcpAudience = "rss-reader",
    )
    private val service = McpClientService(repo, signer, settings)
    private val uid = UUID.randomUUID()

    @Test
    fun issueSignsJwtWithClientIdAndWritesOff() {
        whenever(repo.save(any<McpClientEntity>())).thenAnswer {
            it.getArgument<McpClientEntity>(0).apply { id = UUID.randomUUID() }
        }
        whenever(signer.mcpToken(any(), any(), any(), any(), any(), any())).thenReturn("signed.jwt")

        val issued = service.issue(uid, "tony", " desk ")

        assertEquals("desk", issued.label)
        assertEquals("signed.jwt", issued.token)
        val clientId = argumentCaptor<String>()
        verify(signer).mcpToken(any(), any(), any(), clientId.capture(), any(), any())
        assertEquals(issued.id.toString(), clientId.firstValue)
    }

    @Test
    fun blankLabelFallsBackAndRevokedClientCannotChange() {
        whenever(repo.save(any<McpClientEntity>())).thenAnswer {
            it.getArgument<McpClientEntity>(0).apply { id = UUID.randomUUID() }
        }
        whenever(signer.mcpToken(any(), any(), any(), any(), any(), any())).thenReturn("jwt")

        val issued = service.issue(uid, "tony", "   ")

        assertEquals("AI client", issued.label)
        val revoked = McpClientEntity(id = UUID.randomUUID(), userId = uid, label = "old").apply {
            revokedAt = java.time.Instant.now()
        }
        whenever(repo.findById(revoked.id!!)).thenReturn(Optional.of(revoked))
        assertFalse(service.setWrites(uid, revoked.id!!, true))
    }

    @Test
    fun revokeAndConsentOnlyTouchOwnedClients() {
        val client = McpClientEntity(id = UUID.randomUUID(), userId = uid, label = "desk")
        whenever(repo.findById(client.id!!)).thenReturn(Optional.of(client))
        service.clock = Clock.fixed(Instant.parse("2026-11-22T12:00:00Z"), ZoneOffset.UTC)

        assertTrue(service.setWrites(uid, client.id!!, true))
        assertTrue(client.writesEnabled)
        assertTrue(service.revoke(uid, client.id!!))
        assertFalse(service.revoke(UUID.randomUUID(), client.id!!))
    }
}
