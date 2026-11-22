package userapi.accounts
import java.time.Instant
import java.util.UUID

/** Public client metadata. Never carries a token. */
data class McpClientInfo(val id: UUID, val label: String, val writesEnabled: Boolean, val createdAt: Instant)
