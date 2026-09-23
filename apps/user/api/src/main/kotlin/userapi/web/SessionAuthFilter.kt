package userapi.web

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.core.NestedRuntimeException
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.filter.OncePerRequestFilter
import userapi.accounts.AccountServices
import userapi.domain.sha256Hex

class SessionAuthFilter(private val accounts: AccountServices) : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        loadSession(request)?.let { session ->
            request.setAttribute(SESSION_ATTR, session)
            SecurityContextHolder.getContext().authentication =
                UsernamePasswordAuthenticationToken(session.userId, null, emptyList())
        }
        chain.doFilter(request, response)
    }

    private fun loadSession(request: HttpServletRequest): userapi.accounts.StoredSession? {
        // A dead database must not turn every cookied request (including /healthz)
        // into a 500: fall through unauthenticated and let each route answer 401/503.
        return try {
            val store = accounts.store ?: return null
            val raw = sessionToken(request) ?: return null
            store.findSession(sha256Hex(raw), accounts.clock.instant())
        } catch (_: NestedRuntimeException) {
            null
        }
    }
}
