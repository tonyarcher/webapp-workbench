package userapi.accounts
import org.springframework.stereotype.Service
import userapi.Settings
import userapi.crypto.JwtSigner
import userapi.persist.McpClientEntity
import userapi.persist.McpClientRepo
import java.time.Clock
import java.util.UUID

private const val LABEL_MAX = 80

/** Identity owns MCP clients; the issued token is a signed, short-lived JWT. */
@Service
class McpClientService(
    private val repo: McpClientRepo,
    private val signer: JwtSigner,
    private val settings: Settings,
) {
    internal var clock: Clock = Clock.systemUTC()

    fun issue(userId: UUID, username: String, label: String): McpIssuedClient {
        val name = label.trim().take(LABEL_MAX).ifBlank { "AI client" }
        val row = repo.save(McpClientEntity(userId = userId, label = name))
        val token = signer.mcpToken(
            userId,
            username,
            settings.mcpAudience,
            row.id!!.toString(),
            false,
            clock.instant(),
        )
        return McpIssuedClient(row.id!!, row.label, token)
    }

    fun list(userId: UUID): List<McpClientInfo> =
        repo.findByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(userId).map { it.toInfo() }

    fun revoke(userId: UUID, id: UUID): Boolean {
        val row = own(userId, id) ?: return false
        row.revokedAt = clock.instant()
        repo.save(row)
        return true
    }

    fun setWrites(userId: UUID, id: UUID, enabled: Boolean): Boolean {
        val row = own(userId, id) ?: return false
        row.writesEnabled = enabled
        repo.save(row)
        return true
    }

    private fun own(userId: UUID, id: UUID): McpClientEntity? =
        repo.findById(id).orElse(null)?.takeIf { it.userId == userId && it.revokedAt == null }

    private fun McpClientEntity.toInfo(): McpClientInfo = McpClientInfo(id!!, label, writesEnabled, createdAt)
}
