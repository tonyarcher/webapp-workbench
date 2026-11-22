package rssapi.mcp
import java.util.UUID

/** Resolved by identity on every call. Nothing here is stored in rss-api. */
data class McpPrincipal(val userId: UUID, val clientId: String, val writesEnabled: Boolean)
