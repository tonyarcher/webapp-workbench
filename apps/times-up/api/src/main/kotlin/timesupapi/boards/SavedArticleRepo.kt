package timesupapi.boards
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant
import java.util.UUID

interface SavedArticleRepo : JpaRepository<SavedArticleEntity, UUID> {
    fun findByUserIdOrderBySavedAtDesc(userId: UUID): List<SavedArticleEntity>
    fun findByUserIdAndArticleId(userId: UUID, articleId: String): SavedArticleEntity?
    fun existsByUserIdAndArticleId(userId: UUID, articleId: String): Boolean
    fun deleteByUserIdAndArticleId(userId: UUID, articleId: String)

    interface Summary {
        val id: UUID
        val articleId: String?
        val feedId: UUID?
        val feedTitle: String?
        val title: String
        val link: String?
        val author: String?
        val summary: String?
        val publishedAt: Instant?
        val savedAt: Instant
        val contentPending: Boolean
    }

    @Query(
        """
        select s.id as id, s.articleId as articleId, s.feedId as feedId, s.feedTitle as feedTitle,
               s.title as title, s.link as link, s.author as author, s.summary as summary,
               s.publishedAt as publishedAt, s.savedAt as savedAt,
               case when s.contentStorageKey is not null or s.contentHtml is not null then true else false end as contentPending
        from SavedArticleEntity s
        where s.userId = :userId
        order by s.savedAt desc
        """,
    )
    fun findSummariesByUserIdOrderBySavedAtDesc(@Param("userId") userId: UUID): List<Summary>
}
