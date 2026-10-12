package rssapi.web

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import rssapi.domain.clampPageLimit
import rssapi.frontpage.FrontPageService
import java.time.Instant

@RestController
class FrontPageController(private val user: IdentityUser, private val frontPage: FrontPageService) {
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

    /**
     * Stored-judgment evidence, newest window only. Read-only: unlike
     * /front-page it never refreshes stale rows, so reviewing past
     * decision-model judgments costs no quota. Counts and timestamps only; no titles.
     */
    @GetMapping("/front-page/models", headers = ["X-Api-Version=1"])
    fun frontPageModels(): FrontPageModelsJson {
        val evidence = frontPage.modelEvidence(Instant.now())
        return FrontPageModelsJson(
            generatedAt = Instant.now().toEpochMilli(),
            models = evidence.map {
                ModelEvidenceJson(
                    model = it.model,
                    rows = it.rows,
                    newestAt = it.newestAt?.toEpochMilli(),
                    oldestAt = it.oldestAt?.toEpochMilli(),
                )
            },
        )
    }
}

private fun parseFrontPageSince(since: String?): Long? {
    if (since == null) return null
    return since.toDoubleOrNull()?.toLong() ?: throw ApiException(HttpStatus.BAD_REQUEST, "invalid since")
}
