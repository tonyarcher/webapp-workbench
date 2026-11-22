package rssapi.body

import jakarta.annotation.PreDestroy
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import rssapi.log.log
import rssapi.persist.ArticleBodyEntity
import rssapi.persist.ArticleBodyRepo
import rssapi.persist.ArticleRepo

private const val BATCH_SIZE = 500

/**
 * Copies bodies into their own table in bounded batches, never inside a
 * migration. One-shot: once it stops, new writes must go through [BodyStore],
 * which dual-writes, before the old column can be dropped.
 */
@Component
class ArticleBodyBackfill(private val articles: ArticleRepo, private val bodies: ArticleBodyRepo) {
    @Volatile private var stopped = false

    @Volatile private var done = false

    @PreDestroy
    fun stop() {
        stopped = true
    }

    @Scheduled(fixedDelayString = "\${BODY_BACKFILL_MS:1000}")
    fun runBatch() {
        if (stopped || done) return
        val rows = articles.bodiesToBackfill(PageRequest.of(0, BATCH_SIZE))
        if (rows.isEmpty()) {
            done = true
            log("rss-api", "info", "body backfill complete", emptyMap())
            return
        }
        bodies.saveAll(rows.map { ArticleBodyEntity(it.id, it.contentHtml.orEmpty()) })
    }
}
