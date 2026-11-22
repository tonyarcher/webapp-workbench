package rssapi.mcp
import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import rssapi.platform.ApiException
import java.util.UUID

private val RPC_UID: UUID = UUID.fromString("33333333-3333-3333-3333-333333333333")

class McpControllerTest {
    private val principals: McpPrincipalService = mock()
    private val dispatcher: McpToolDispatcher = mock()
    private val controller = McpController(principals, dispatcher, ObjectMapper())
    private val principal = McpPrincipal(RPC_UID, "desk", false)

    @Test
    fun missingIdentityIsRejected() {
        whenever(principals.current()).thenThrow(ApiException(HttpStatus.UNAUTHORIZED, "unauthorized"))
        val err = assertThrows<ApiException> { controller.rpc(McpRpcRequest(method = "ping")) }
        assertEquals(HttpStatus.UNAUTHORIZED, err.status)
    }

    @Test
    fun initializeAndUnknownMethodUseJsonRpcEnvelope() {
        whenever(principals.current()).thenReturn(principal)
        val ready = controller.rpc(McpRpcRequest(id = 1, method = "initialize"))
        val bad = controller.rpc(McpRpcRequest(id = 2, method = "nope"))
        assertEquals("2.0", ready.jsonrpc)
        assertEquals(1, ready.id)
        assertEquals("rss-reader", ((ready.result as Map<*, *>)["serverInfo"] as Map<*, *>)["name"])
        assertEquals(-32601, bad.error?.code)
    }

    @Test
    fun toolsListFollowsConsent() {
        whenever(principals.current()).thenReturn(principal)
        val readOnly = controller.rpc(McpRpcRequest(id = 1, method = "tools/list"))
        val tools = ((readOnly.result as? Map<*, *>)?.get("tools") as? List<*>)
            ?.filterIsInstance<McpTool>().orEmpty()
        assertFalse(tools.any { it.name == "star_article" })
        assertTrue(McpToolRegistry.tools(true).any { it.name == "star_article" })
        assertTrue(tools.all { it.inputSchema["type"] == "object" })
    }

    @Test
    fun initializeEchoesRequestedVersionAndPingIsEmpty() {
        whenever(principals.current()).thenReturn(principal)
        val init = controller.rpc(
            McpRpcRequest(id = 1, method = "initialize", params = mapOf("protocolVersion" to "2025-06-18")),
        )
        assertEquals("2025-06-18", ((init.result as Map<*, *>)["protocolVersion"]))
        assertEquals(emptyMap<Any, Any>(), controller.rpc(McpRpcRequest(id = 2, method = "ping")).result)
        assertEquals(
            emptyMap<Any, Any>(),
            controller.rpc(McpRpcRequest(id = 3, method = "notifications/initialized")).result,
        )
    }

    @Test
    fun malformedToolCallsUseJsonRpcError() {
        whenever(principals.current()).thenReturn(principal)
        val noParams = controller.rpc(McpRpcRequest(id = 1, method = "tools/call"))
        assertEquals(-32602, noParams.error?.code)
        val blankName = controller.rpc(
            McpRpcRequest(id = 2, method = "tools/call", params = mapOf("name" to "  ")),
        )
        assertEquals(-32602, blankName.error?.code)
        whenever(dispatcher.execute(any(), any(), any())).thenReturn(emptyMap<String, Any>())
        val args = controller.rpc(
            McpRpcRequest(
                id = 3,
                method = "tools/call",
                params = mapOf("name" to "list_feeds", "arguments" to mapOf("q" to "ai")),
            ),
        )
        assertEquals(3, args.id)
    }

    @Test
    fun toolErrorsStayInEnvelope() {
        whenever(principals.current()).thenReturn(principal)
        whenever(
            dispatcher.execute(any(), any(), any()),
        ).thenThrow(ApiException(HttpStatus.NOT_FOUND, "Article not found"))
        val apiError = controller.rpc(
            McpRpcRequest(id = 4, method = "tools/call", params = mapOf("name" to "open_summary")),
        )
        assertEquals(-32000, apiError.error?.code)

        whenever(dispatcher.execute(any(), any(), any())).thenThrow(RuntimeException("boom"))
        val unknown = controller.rpc(
            McpRpcRequest(id = 5, method = "tools/call", params = mapOf("name" to "open_summary")),
        )
        assertEquals("tool failed", unknown.error?.message)
    }

    @Test
    fun toolCallWrapsResultAsTextContent() {
        whenever(principals.current()).thenReturn(principal)
        whenever(dispatcher.execute(any(), any(), any())).thenReturn(mapOf("ok" to true))
        val res = controller.rpc(
            McpRpcRequest(id = 3, method = "tools/call", params = mapOf("name" to "list_feeds")),
        )
        val content = ((res.result as Map<*, *>)["content"] as List<*>)[0] as Map<*, *>
        assertEquals("text", content["type"])
        assertEquals("{\"ok\":true}", content["text"])
    }
}
