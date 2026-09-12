package rssapi.web

import java.util.UUID
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component
import org.springframework.web.context.annotation.RequestScope
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo

@Component
@RequestScope
class IdentityUser(private val users: UserRepo) {
    val id: UUID by lazy { entity.id!! }
    val username: String? by lazy { entity.username }

    private val entity: UserEntity by lazy { resolve(subject(), usernameClaim()) }

    private fun subject(): String {
        val auth = SecurityContextHolder.getContext().authentication as? JwtAuthenticationToken
            ?: throw ApiException(401, "unauthorized")
        return auth.token.subject?.takeIf { it.isNotBlank() }
            ?: throw ApiException(401, "unauthorized")
    }

    private fun usernameClaim(): String? {
        val auth = SecurityContextHolder.getContext().authentication as? JwtAuthenticationToken
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
            users.save(UserEntity(label = "identity", subject = subject, username = name))
        } catch (_: DataIntegrityViolationException) {
            // A parallel first request provisioned the same subject.
            users.findBySubject(subject) ?: throw ApiException(500, "internal error")
        }
    }
}
