package rssapi.persist

import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant

interface ArticleScoreRepo : JpaRepository<ArticleScoreEntity, String> {
    /** Score rows touched since the cutoff, bounding the evidence read. */
    fun findAllByScoredAtAfter(since: Instant): List<ArticleScoreEntity>
}
