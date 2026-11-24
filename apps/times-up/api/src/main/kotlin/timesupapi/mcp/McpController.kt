package timesupapi.mcp
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import timesupapi.platform.ApiException

private const val PROTOCOL_VERSION = "2025-06-18"
private const val UNKNOWN_METHOD = -32601
private const val INVALID_PARAMS = -32602
private const val TOOL_ERROR = -32000

/** One transport: JSON-RPC 2.0 over Spring MVC, with JSON responses (no SSE). */
@RestController
class McpController(
    private val principals: McpPrincipalService,
    private val dispatcher: McpToolDispatcher,
    private val mapper: ObjectMapper,
) {
    @PostMapping("/mcp", headers = ["X-Api-Version=1"], consumes = ["application/json"])
    fun rpc(@RequestBody req: McpRpcRequest): McpRpcResponse {
        val client = principals.current()
        return try {
            McpRpcResponse(id = req.id, result = dispatch(req, client))
        } catch (err: RpcException) {
            McpRpcResponse(id = req.id, error = McpRpcError(err.code, err.message ?: "rpc error"))
        } catch (err: ApiException) {
            McpRpcResponse(id = req.id, error = McpRpcError(TOOL_ERROR, err.message ?: "tool failed"))
        } catch (_: Exception) {
            McpRpcResponse(id = req.id, error = McpRpcError(TOOL_ERROR, "tool failed"))
        }
    }

    private fun dispatch(req: McpRpcRequest, client: McpPrincipal): Any = when (req.method) {
        "initialize" -> mapOf(
            "protocolVersion" to (req.params?.get("protocolVersion")?.toString() ?: PROTOCOL_VERSION),
            "capabilities" to mapOf("tools" to emptyMap<String, Any>()),
            "serverInfo" to mapOf("name" to "times-up", "version" to "1"),
        )

        "notifications/initialized", "ping" -> emptyMap<String, Any>()

        "tools/list" -> mapOf("tools" to McpToolRegistry.tools(client.writesEnabled))

        "tools/call" -> call(req.params, client)

        else -> throw RpcException(UNKNOWN_METHOD, "unknown method")
    }

    private fun call(params: Map<String, Any?>?, client: McpPrincipal): Any {
        val name = params?.get("name")?.toString()?.takeIf { it.isNotBlank() }
            ?: throw RpcException(INVALID_PARAMS, "name is required")
        val args = arguments(params)
        val value = dispatcher.execute(client, name, args)
        return mapOf("content" to listOf(mapOf("type" to "text", "text" to mapper.writeValueAsString(value))))
    }

    private fun arguments(params: Map<String, Any?>?): Map<String, Any?> {
        val raw = params?.get("arguments") as? Map<*, *> ?: return emptyMap()
        return raw.entries.associate { it.key.toString() to it.value }
    }
}

/** Local signal kept distinct from API errors so JSON-RPC codes stay in the envelope. */
private class RpcException(val code: Int, message: String) : RuntimeException(message)
