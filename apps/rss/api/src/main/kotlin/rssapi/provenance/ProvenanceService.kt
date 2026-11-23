package rssapi.provenance

import org.springframework.stereotype.Service
import rssapi.articles.ArticleEntity
import rssapi.feeds.FeedRepo
import rssapi.storage.BodyStore

/** Builds the provenance record for one already-authorized article row. */
@Service
class ProvenanceService(private val feeds: FeedRepo, private val bodyStore: BodyStore) {
    fun load(article: ArticleEntity): ArticleProvenanceJson {
        val extracted = ProvenanceExtractor.extract(article.id, bodyStore.get(article.id), article.excerpt)
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
            quotes = extracted.quotes.map(::toJson),
            figures = extracted.figures.map(::toJson),
        )
    }

    private fun toJson(e: Evidence) = EvidenceJson(e.id, e.articleId, e.kind, e.text)
}
