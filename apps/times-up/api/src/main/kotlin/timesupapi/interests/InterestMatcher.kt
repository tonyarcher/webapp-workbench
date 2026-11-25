package timesupapi.interests

import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import timesupapi.clusters.ArticleTopicRepo
import java.time.Instant
import java.util.UUID

@Service
class InterestMatcher(private val topics: ArticleTopicRepo) {
    fun matchingArticles(interestKeys: Set<String>, sinceMs: Long): List<String> {
        if (interestKeys.isEmpty()) return emptyList()
        val since = Instant.ofEpochMilli(sinceMs)
        val rows = topics.recent(since, PageRequest.of(0, 10_000))
        return rows.filter { it.topicKey in interestKeys }.map { it.articleId }.distinct()
    }
}
