package rssapi.web

import java.util.UUID
import org.springframework.stereotype.Component
import org.springframework.web.context.annotation.RequestScope
import rssapi.domain.cookieOpts
import rssapi.domain.isUuid
import rssapi.domain.parseCookies
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse

@Component
@RequestScope
class CookieUser(
    private val users: UserRepo,
    private val request: HttpServletRequest,
    private val response: HttpServletResponse,
) {
    val id: UUID by lazy { resolve().id!! }

    private fun resolve(): UserEntity {
        val uid = parseCookies(request.getHeader("Cookie"))["rss_uid"]
        if (isUuid(uid)) {
            users.findById(UUID.fromString(uid)).orElse(null)?.let { return it }
        }
        val created = users.save(UserEntity(label = "local"))
        val https = "https" == request.getHeader("X-Forwarded-Proto")
        response.addHeader("Set-Cookie", "rss_uid=${created.id}; ${cookieOpts(https)}")
        return created
    }
}
