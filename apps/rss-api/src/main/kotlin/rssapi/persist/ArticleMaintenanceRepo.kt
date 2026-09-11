package rssapi.persist

import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface ArticleMaintenanceRepo : JpaRepository<ArticleEntity, String> {
    @Modifying
    @Query(
        value = """
        UPDATE articles a SET
          popularity = 1+3*GREATEST(sub.cnt-1,0)+LEAST(GREATEST(COALESCE(a.comments,0),0),50),
          hot = log(GREATEST(1+3*GREATEST(sub.cnt-1,0)+LEAST(GREATEST(COALESCE(a.comments,0),0),50)
                +GREATEST(a.engagement,0),1)::numeric)
                +(EXTRACT(EPOCH FROM a.published_at)-1134028003)/90000
        FROM (
          SELECT norm_link, COUNT(DISTINCT feed_id) AS cnt FROM articles
          WHERE norm_link = ANY(:links) AND feed_id IN (SELECT id FROM feeds WHERE user_id = :userId)
          GROUP BY norm_link
        ) sub
        WHERE a.norm_link = sub.norm_link
          AND a.feed_id IN (SELECT id FROM feeds WHERE user_id = :userId)
        """,
        nativeQuery = true,
    )
    fun updatePopularity(@Param("userId") userId: UUID, @Param("links") links: Array<String>)

    @Modifying
    @Query(
        value = """
        UPDATE articles SET
          popularity = 1+LEAST(GREATEST(COALESCE(comments,0),0),50),
          hot = log(GREATEST(1+LEAST(GREATEST(COALESCE(comments,0),0),50)+GREATEST(engagement,0),1)::numeric)
                +(EXTRACT(EPOCH FROM published_at)-1134028003)/90000
        WHERE feed_id = :feedId AND norm_link IS NULL
        """,
        nativeQuery = true,
    )
    fun updateLonelyHot(@Param("feedId") feedId: UUID)

    @Modifying
    @Query(
        value = """
        DELETE FROM articles a
        WHERE a.feed_id = :feedId
          AND NOT EXISTS (SELECT 1 FROM article_state s WHERE s.article_id = a.id AND s.starred)
          AND a.id NOT IN (
            SELECT id FROM articles WHERE feed_id = :feedId ORDER BY published_at DESC LIMIT :keep
          )
        """,
        nativeQuery = true,
    )
    fun pruneFeed(@Param("feedId") feedId: UUID, @Param("keep") keep: Int)
}
