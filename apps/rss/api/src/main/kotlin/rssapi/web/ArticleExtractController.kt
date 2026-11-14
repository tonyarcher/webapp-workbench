package rssapi.web

import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController
import rssapi.ingest.ArticleExtractService

data class ArticleExtractJson(val article: ArticleJson, val extracted: Boolean, val sourceUrl: String?)

@RestController
class ArticleExtractController(private val user: IdentityUser, private val extract: ArticleExtractService) {
    /**
     * Dynamically fetch and extract the full article text from its source page
     * (SSRF-safe). On meaningful gain the enriched content is persisted so
     * highlights and reads benefit. Called for articles the user wants to read.
     */
    @PostMapping("/articles/{articleId}/extract", headers = ["X-Api-Version=1"])
    fun extract(@PathVariable articleId: String): ArticleExtractJson {
        val result = extract.extractForUser(user.id, articleId)
        return ArticleExtractJson(result.article.toJson(null), result.extracted, result.sourceUrl)
    }
}
