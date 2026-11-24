package timesupapi.mcp
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component
import timesupapi.platform.ApiException
import timesupapi.platform.IdentityUser
import java.util.UUID

/** Reads identity claims from the normal JWT filter chain. No HTTP call to user-api. */
@Component
class McpPrincipalService(private val users: IdentityUser) {
    fun current(): McpPrincipal {
        val auth = SecurityContextHolder.getContext().authentication as? JwtAuthenticationToken
        val jwt = auth?.token
        val clientId = jwt?.getClaimAsString("mcp_client_id")?.takeIf { it.isNotBlank() }
        val subject = jwt?.subject?.takeIf { it.isNotBlank() }
        val userId = subject?.let { runCatching { UUID.fromString(it) }.getOrNull() }
        if (jwt == null || clientId == null || userId == null) throw unauthorized()
        val writes = jwt.getClaim<Any>("mcp_writes") == true
        return McpPrincipal(users.id, clientId, writes)
    }

    private fun unauthorized() = ApiException(HttpStatus.UNAUTHORIZED, "unauthorized")
}
