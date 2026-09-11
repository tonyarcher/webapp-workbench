package rssapi.persist

import java.util.UUID
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface ArticleRepo : JpaRepository<ArticleEntity, String>, JpaSpecificationExecutor<ArticleEntity> {
    fun findByFeedIdAndGuid(feedId: UUID, guid: String): ArticleEntity?
    fun findByFeedIdOrderByPublishedAtDesc(feedId: UUID, page: Pageable): List<ArticleEntity>
    fun findByFeedIdAndNormLink(feedId: UUID, normLink: String): ArticleEntity?
    fun findByFeedIdIn(feedIds: Collection<UUID>): List<ArticleEntity>

    @Query(
        """
        select count(a) from ArticleEntity a
        where a.feedId = :feedId
          and not exists (
            select 1 from ArticleStateEntity s
            where s.articleId = a.id and s.userId = :userId and s.read = true
          )
        """,
    )
    fun countUnread(@Param("feedId") feedId: UUID, @Param("userId") userId: UUID): Long
}
