package rssapi.web

import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component
import org.springframework.web.context.annotation.RequestScope
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo
import java.time.Duration
import java.time.Instant
import java.util.UUID

@Component
@RequestScope
class IdentityUser(private val users: UserRepo) {
    val id: UUID by lazy { entity.id!! }
    val username: String? by lazy { entity.username }

    private val entity: UserEntity by lazy { resolve(subject(), usernameClaim()) }

    private fun subject(): String {
        val auth = SecurityContextHolder.getContext().authentication as? JwtAuthenticationToken
            ?: throw ApiException(HttpStatus.UNAUTHORIZED, "unauthorized")
        return auth.token.subject?.takeIf { it.isNotBlank() }
            ?: throw ApiException(HttpStatus.UNAUTHORIZED, "unauthorized")
    }

    private fun usernameClaim(): String? {
        val auth = SecurityContextHolder.getContext().authentication as? JwtAuthenticationToken
            ?: return null
        return auth.token.getClaimAsString("preferred_username")
    }

    private fun resolve(subject: String, name: String?): UserEntity {
        val existing = users.findBySubject(subject)
        if (existing != null) {
            touch(existing, name)
            return existing
        }
        return try {
            users.save(
                UserEntity(
                    label = "identity",
                    subject = subject,
                    username = name,
                    lastSeenAt = Instant.now(),
                ),
            )
        } catch (_: DataIntegrityViolationException) {
            // A parallel first request provisioned the same subject.
            val raced =
                users.findBySubject(subject) ?: throw ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "internal error")
            touch(raced, name)
            return raced
        }
    }

    private fun touch(existing: UserEntity, name: String?) {
        var dirty = false
        if (name != null && existing.username != name) {
            existing.username = name
            dirty = true
        }
        val now = Instant.now()
        val last = existing.lastSeenAt
        if (last == null || Duration.between(last, now).toMillis() >= LAST_SEEN_TOUCH_MS) {
            existing.lastSeenAt = now
            dirty = true
        }
        if (dirty) users.save(existing)
    }

    companion object {
        /** Throttle last-seen writes so every API call does not become a DB write. */
        const val LAST_SEEN_TOUCH_MS: Long = 60 * 60 * 1_000L
    }
}
