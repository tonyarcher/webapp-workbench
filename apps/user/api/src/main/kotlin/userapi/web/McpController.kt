package userapi.web
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import userapi.accounts.McpClientService
import java.util.UUID

/** Identity owns MCP clients. rss-api trusts the signed tokens issued here. */
@RestController
class McpController(private val clients: McpClientService) {
    @GetMapping("/oauth/mcp/clients", headers = ["X-Api-Version=1"])
    fun list(request: HttpServletRequest): Map<String, Any> =
        mapOf("clients" to clients.list(requestSession(request).userId))

    @PostMapping("/oauth/mcp/clients", headers = ["X-Api-Version=1"])
    fun issue(request: HttpServletRequest, @RequestBody body: McpClientBody): Map<String, Any> {
        val session = requestSession(request)
        val issued = clients.issue(session.userId, session.username.orEmpty(), body.label.orEmpty())
        return mapOf("id" to issued.id, "label" to issued.label, "token" to issued.token)
    }

    @DeleteMapping("/oauth/mcp/clients/{id}", headers = ["X-Api-Version=1"])
    fun revoke(request: HttpServletRequest, @PathVariable id: String): Map<String, Any> {
        if (!clients.revoke(requestSession(request).userId, parseId(id))) throw notFound()
        return mapOf("ok" to true)
    }

    @PatchMapping("/oauth/mcp/clients/{id}/consent", headers = ["X-Api-Version=1"])
    fun consent(
        request: HttpServletRequest,
        @PathVariable id: String,
        @RequestBody body: McpConsentBody,
    ): Map<String, Any> {
        val enabled = body.enabled ?: throw ApiException(HttpStatus.BAD_REQUEST, "invalid", "enabled is required")
        if (!clients.setWrites(requestSession(request).userId, parseId(id), enabled)) throw notFound()
        return mapOf("ok" to true)
    }

    private fun parseId(raw: String): UUID = try {
        UUID.fromString(raw.trim())
    } catch (_: IllegalArgumentException) {
        throw ApiException(HttpStatus.BAD_REQUEST, "invalid", "invalid client id")
    }

    private fun notFound() = ApiException(HttpStatus.NOT_FOUND, "not_found", "client not found")
}
