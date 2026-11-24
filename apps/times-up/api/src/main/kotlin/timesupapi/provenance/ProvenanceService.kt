package timesupapi.provenance

import org.springframework.stereotype.Service
import timesupapi.articles.ArticleEntity
import timesupapi.feeds.FeedRepo

/**
 * Reads learned provenance metadata for one already-authorized article row.
 * No body or full excerpt is read here: article text was consumed once by
 * [ArticleEvidenceExtractor] and is disposable afterwards.
 */
@Service
class ProvenanceService(private val feeds: FeedRepo, private val evidence: ArticleEvidenceRepo) {
    fun load(article: ArticleEntity): ArticleProvenanceJson {
        val rows = evidence.findByArticleIdOrderByKindAscIdAsc(article.id)
        val feed = feeds.findById(article.feedId).orElse(null)
        return ArticleProvenanceJson(
            articleId = article.id,
            source = SourceRowJson(
                articleId = article.id,
                feedId = article.feedId.toString(),
                feedTitle = feed?.title.orEmpty(),
                sourceKind = article.sourceKind,
                connectorId = article.connectorId,
                connectorVersion = article.connectorVersion,
                fetchMode = article.fetchMode,
                canonicalUrl = article.canonicalUrl,
                sourceUrl = article.sourceUrl,
                fetchedAt = article.fetchedAt.toEpochMilli(),
            ),
            quotes = rows.filter { it.kind == "quote" }.map(::toJson),
            figures = rows.filter { it.kind == "figure" }.map(::toJson),
        )
    }

    private fun toJson(e: ArticleEvidenceEntity) = EvidenceJson(e.id, e.articleId, e.kind, e.evidenceText)
}
