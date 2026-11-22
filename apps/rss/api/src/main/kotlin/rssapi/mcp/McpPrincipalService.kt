package rssapi.mcp
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component
import rssapi.platform.ApiException
import java.util.UUID

/** Reads identity claims from the normal JWT filter chain. No HTTP call to user-api. */
@Component
class McpPrincipalService {
    fun current(): McpPrincipal {
        val auth = SecurityContextHolder.getContext().authentication as? JwtAuthenticationToken
        val jwt = auth?.token
        val clientId = jwt?.getClaimAsString("mcp_client_id")?.takeIf { it.isNotBlank() }
        val userId = jwt?.subject?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        if (jwt == null || clientId == null || userId == null) throw unauthorized()
        val writes = jwt.getClaim<Any>("mcp_writes") == true
        return McpPrincipal(userId, clientId, writes)
    }

    private fun unauthorized() = ApiException(HttpStatus.UNAUTHORIZED, "unauthorized")
}
