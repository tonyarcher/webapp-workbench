package userapi.accounts
import java.util.UUID

/** Raw token is returned once; only its hash is persisted. */
data class McpIssuedClient(val id: UUID, val label: String, val token: String)
