package rssapi.mcp

/** MCP tool descriptor. Schemas are static; no client-supplied schema is accepted. */
data class McpTool(val name: String, val description: String, val inputSchema: Map<String, Any>)
