package rssapi.mcp
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import rssapi.platform.ApiException
import java.util.UUID

class McpPrincipalServiceTest {
    private val service = McpPrincipalService()
    private val uid = UUID.randomUUID()

    @AfterEach
    fun clear() = SecurityContextHolder.clearContext()

    private fun authenticate(jwt: Jwt?) {
        val auth = if (jwt == null) {
            UsernamePasswordAuthenticationToken("none", "none", emptyList())
        } else {
            JwtAuthenticationToken(jwt)
        }
        SecurityContextHolder.getContext().authentication = auth
    }

    private fun jwt(claims: Map<String, Any>, subject: String? = uid.toString()): Jwt = mock<Jwt>().apply {
        whenever(this.subject).thenReturn(subject)
        claims.forEach { (key, value) -> whenever(getClaim<Any>(key)).thenReturn(value) }
        whenever(getClaimAsString("mcp_client_id")).thenReturn(claims["mcp_client_id"] as? String)
    }

    @Test
    fun readsMcpClaimsFromJwt() {
        authenticate(jwt(mapOf("mcp_client_id" to "desk", "mcp_writes" to true)))
        val principal = service.current()
        assertEquals(uid, principal.userId)
        assertEquals("desk", principal.clientId)
        assertEquals(true, principal.writesEnabled)
    }

    @Test
    fun rejectsTokenWithoutMcpClaim() {
        authenticate(jwt(mapOf("mcp_writes" to false)))
        val err = assertThrows<ApiException> { service.current() }
        assertEquals(HttpStatus.UNAUTHORIZED, err.status)
    }

    @Test
    fun rejectsBlankClientIdAndInvalidSubject() {
        authenticate(jwt(mapOf("mcp_client_id" to "  ", "mcp_writes" to false)))
        assertThrows<ApiException> { service.current() }
        authenticate(jwt(mapOf("mcp_client_id" to "desk"), subject = "not-a-uuid"))
        assertThrows<ApiException> { service.current() }
    }

    @Test
    fun rejectsNonJwtAuthentication() {
        authenticate(null)
        val err = assertThrows<ApiException> { service.current() }
        assertEquals(HttpStatus.UNAUTHORIZED, err.status)
    }
}
