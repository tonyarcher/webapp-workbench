package stockgame.web

import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component
import org.springframework.web.context.annotation.RequestScope
import stockgame.persist.UserEntity
import stockgame.persist.UserRepo
import java.util.UUID

@Component
@RequestScope
class IdentityUser(private val users: UserRepo) {
    val id: UUID by lazy { entity.id!! }
    val username: String? by lazy { entity.username }

    private val entity: UserEntity by lazy { resolve(subject(), usernameClaim()) }

    private fun subject(): String {
        val auth =
            SecurityContextHolder.getContext().authentication as? JwtAuthenticationToken
                ?: throw ApiException(HttpStatus.UNAUTHORIZED, "unauthorized")
        return auth.token.subject?.takeIf { it.isNotBlank() }
            ?: throw ApiException(HttpStatus.UNAUTHORIZED, "unauthorized")
    }

    private fun usernameClaim(): String? {
        val auth =
            SecurityContextHolder.getContext().authentication as? JwtAuthenticationToken
                ?: return null
        return auth.token.getClaimAsString("preferred_username")
    }

    private fun resolve(subject: String, name: String?): UserEntity {
        val existing = users.findBySubject(subject)
        if (existing != null) {
            if (name != null && existing.username != name) {
                existing.username = name
                users.save(existing)
            }
            return existing
        }
        return try {
            users.save(UserEntity(subject = subject, username = name))
        } catch (_: DataIntegrityViolationException) {
            // A parallel first request provisioned the same subject.
            users.findBySubject(subject) ?: throw ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "internal error")
        }
    }
}
