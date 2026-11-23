package rssapi.clusters

import jakarta.annotation.PreDestroy
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import rssapi.platform.log.log
import java.time.Instant

private const val BATCH_SIZE = 200

/**
 * Learns topic keys from article text once, then marks the article extracted.
 * Only keys persist; every later feature reads [ArticleTopicRepo], not the
 * article's headline, body or excerpt.
 */
@Component
class ArticleTopicExtractor(private val articles: TopicArticleRepo, private val topics: ArticleTopicRepo) {
    @Volatile private var stopped = false

    @PreDestroy
    fun stop() {
        stopped = true
    }

    @Scheduled(fixedDelayString = "\${ARTICLE_TOPIC_MS:60000}")
    @Transactional
    fun runBatch() {
        if (stopped) return
        val batch = articles.candidates(PageRequest.of(0, BATCH_SIZE))
        if (batch.isEmpty()) return
        val now = Instant.now()
        for (article in batch) {
            val keys = TopicKeyExtractor.keys(article.title, article.normLink, article.canonicalUrl, article.sourceUrl)
            topics.deleteByArticleId(article.id)
            if (keys.isNotEmpty()) {
                topics.saveAll(keys.map { ArticleTopicEntity(articleId = article.id, topicKey = it) })
            }
            articles.markExtracted(article.id, now)
        }
        log("rss-api", "info", "topic key batch", mapOf("extracted" to batch.size.toString()))
    }
}
