package rssapi.persist

import java.time.Instant
import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface ArticleStateRepo : JpaRepository<ArticleStateEntity, ArticleStateId> {
    fun findByUserIdAndArticleIdIn(userId: UUID, ids: Collection<String>): List<ArticleStateEntity>
    fun countByUserIdAndArticleIdInAndReadFalse(userId: UUID, ids: Collection<String>): Long

    /**
     * Bulk mark-read without loading articles into memory. One statement for
     * any feed set size; existing starred flags are preserved on conflict.
     * Two variants so every bind has a known type (a nullable timestamptz
     * bind fails Postgres parameter inference with 42P18).
     */
    @Modifying
    @Query(
        value = """
        INSERT INTO article_state (user_id, article_id, read, read_at, starred)
        SELECT :userId, a.id, true, now(), false
        FROM articles a
        WHERE a.feed_id IN (:feedIds)
          AND a.published_at < :cutoff
        ON CONFLICT (user_id, article_id) DO UPDATE SET read = true, read_at = now()
        """,
        nativeQuery = true,
    )
    fun markReadBefore(
        @Param("userId") userId: UUID,
        @Param("feedIds") feedIds: Collection<UUID>,
        @Param("cutoff") cutoff: Instant,
    ): Int

    @Modifying
    @Query(
        value = """
        INSERT INTO article_state (user_id, article_id, read, read_at, starred)
        SELECT :userId, a.id, true, now(), false
        FROM articles a
        WHERE a.feed_id IN (:feedIds)
        ON CONFLICT (user_id, article_id) DO UPDATE SET read = true, read_at = now()
        """,
        nativeQuery = true,
    )
    fun markReadAll(
        @Param("userId") userId: UUID,
        @Param("feedIds") feedIds: Collection<UUID>,
    ): Int
}
