package rssapi.web

import java.time.Instant
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.clampPageLimit
import rssapi.frontpage.FrontPageService

@RestController
class FrontPageController(
    private val user: IdentityUser,
    private val frontPage: FrontPageService,
) {
    @GetMapping("/front-page", headers = ["X-Api-Version=1"])
    fun frontPage(
        @RequestParam(required = false) since: String?,
        @RequestParam(required = false) unreadOnly: String?,
        @RequestParam(required = false) limit: String?,
    ): FrontPageJson {
        val sinceMs = parseFrontPageSince(since)
        val pageLimit = clampPageLimit(limit?.toDoubleOrNull())
        val rows = frontPage.frontPage(user.id, sinceMs, unreadOnly == "1", pageLimit)
        return FrontPageJson(
            generatedAt = Instant.now().toEpochMilli(),
            articles = rows.map { it.article.toJson(it.state, it.scoreRow) },
        )
    }
}

private fun parseFrontPageSince(since: String?): Long? {
    if (since == null) return null
    return since.toDoubleOrNull()?.toLong() ?: throw ApiException(400, "invalid since")
}
