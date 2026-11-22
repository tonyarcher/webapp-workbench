package rssapi.body

import jakarta.annotation.PreDestroy
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import rssapi.domain.excerptOf
import rssapi.domain.firstImageUrl
import rssapi.log.log
import rssapi.persist.ArticleRepo

private const val BATCH_SIZE = 500

/** Fills plain-text excerpts and derived images so list reads stay narrow. */
@Component
class ArticleExcerptBackfill(private val articles: ArticleRepo) {
    @Volatile private var stopped = false

    @Volatile private var done = false
    private var copied = 0L

    @PreDestroy
    fun stop() {
        stopped = true
    }

    @Scheduled(fixedDelayString = "\${EXCERPT_BACKFILL_MS:1000}")
    @Transactional
    fun runBatch() {
        if (stopped || done) return
        val rows = articles.excerptsToBackfill(PageRequest.of(0, BATCH_SIZE))
        if (rows.isEmpty()) {
            done = true
            log("rss-api", "info", "excerpt backfill complete", mapOf("copied" to copied))
            return
        }
        rows.forEach { row ->
            val html = row.contentHtml ?: return@forEach
            articles.setExcerpt(row.id, excerptOf(html))
            firstImageUrl(html, row.link)?.let { articles.setImageIfBlank(row.id, it) }
        }
        copied += rows.size
    }
}
