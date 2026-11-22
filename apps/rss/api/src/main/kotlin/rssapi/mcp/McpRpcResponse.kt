package rssapi.mcp

data class McpRpcResponse(
    val jsonrpc: String = "2.0",
    val id: Any? = null,
    val result: Any? = null,
    val error: McpRpcError? = null,
)
