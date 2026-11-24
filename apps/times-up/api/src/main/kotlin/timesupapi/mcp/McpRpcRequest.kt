package timesupapi.mcp

/** JSON-RPC 2.0 request. Params stay opaque; only fixed tools can consume them. */
data class McpRpcRequest(
    val jsonrpc: String? = null,
    val id: Any? = null,
    val method: String? = null,
    val params: Map<String, Any?>? = null,
)
