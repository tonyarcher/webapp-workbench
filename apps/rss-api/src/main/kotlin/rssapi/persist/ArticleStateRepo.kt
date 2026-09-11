package rssapi.persist

import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository

interface ArticleStateRepo : JpaRepository<ArticleStateEntity, ArticleStateId> {
    fun findByUserIdAndArticleIdIn(userId: UUID, ids: Collection<String>): List<ArticleStateEntity>
    fun countByUserIdAndArticleIdInAndReadFalse(userId: UUID, ids: Collection<String>): Long
}
