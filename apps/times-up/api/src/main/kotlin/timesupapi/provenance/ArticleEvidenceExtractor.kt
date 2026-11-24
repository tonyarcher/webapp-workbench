package timesupapi.provenance

import jakarta.annotation.PreDestroy
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import timesupapi.platform.log.log
import timesupapi.storage.BodyStore
import java.time.Instant

private const val BATCH_SIZE = 200

/**
 * Learns evidence once from article text, then marks the article extracted.
 * This is the only place a body is read for provenance; reads afterwards use
 * the stored [ArticleEvidenceEntity] rows.
 */
@Component
class ArticleEvidenceExtractor(
    private val articles: EvidenceArticleRepo,
    private val evidence: ArticleEvidenceRepo,
    private val bodyStore: BodyStore,
) {
    @Volatile private var stopped = false

    @PreDestroy
    fun stop() {
        stopped = true
    }

    @Scheduled(fixedDelayString = "\${ARTICLE_EVIDENCE_MS:60000}")
    @Transactional
    fun runBatch() {
        if (stopped) return
        val batch = articles.candidates(PageRequest.of(0, BATCH_SIZE))
        if (batch.isEmpty()) return
        val now = Instant.now()
        for (article in batch) {
            val found = ProvenanceExtractor.extract(article.id, bodyStore.get(article.id), article.excerpt)
            evidence.deleteByArticleId(article.id)
            val rows = (found.quotes + found.figures).map {
                ArticleEvidenceEntity(id = it.id, articleId = it.articleId, kind = it.kind, evidenceText = it.text)
            }
            if (rows.isNotEmpty()) evidence.saveAll(rows)
            articles.markExtracted(article.id, now)
        }
        log("times-up-api", "info", "evidence batch", mapOf("extracted" to batch.size.toString()))
    }
}
