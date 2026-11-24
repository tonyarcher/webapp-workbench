package timesupapi.mcp
import java.util.UUID

/** Resolved by identity on every call. Nothing here is stored in times-up-api. */
data class McpPrincipal(val userId: UUID, val clientId: String, val writesEnabled: Boolean)
