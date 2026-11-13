package rssapi.persist

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface SavedArticleRepo : JpaRepository<SavedArticleEntity, UUID> {
    fun findByUserIdOrderBySavedAtDesc(userId: UUID): List<SavedArticleEntity>
    fun findByUserIdAndArticleId(userId: UUID, articleId: String): SavedArticleEntity?
    fun existsByUserIdAndArticleId(userId: UUID, articleId: String): Boolean
    fun deleteByUserIdAndArticleId(userId: UUID, articleId: String)
}
