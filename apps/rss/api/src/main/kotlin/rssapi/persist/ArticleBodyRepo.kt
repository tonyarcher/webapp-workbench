package rssapi.persist

import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

interface ArticleBodyRepo : JpaRepository<ArticleBodyEntity, String> {
    interface OffloadRow {
        val articleId: String
        val contentHtml: String?
    }

    @Query(
        """
        select b.articleId as articleId, b.contentHtml as contentHtml
          from ArticleBodyEntity b, ArticleEntity a
         where b.articleId = a.id
           and b.storageKey is null
           and b.contentHtml is not null
           and a.fetchedAt < :cutoff
         order by a.fetchedAt asc
        """,
    )
    fun offloadCandidates(@Param("cutoff") cutoff: Instant, page: Pageable): List<OffloadRow>

    @Modifying
    @Query(
        """
        update ArticleBodyEntity b
           set b.contentHtml = null, b.storageKey = :storageKey, b.byteSize = :byteSize
         where b.articleId = :articleId and b.storageKey is null
        """,
    )
    fun markOffloaded(
        @Param("articleId") articleId: String,
        @Param("storageKey") storageKey: String,
        @Param("byteSize") byteSize: Long,
    ): Int

    /** Live database size, for the offload trigger. Never logs a payload. */
    @Query(value = "select pg_database_size(current_database())", nativeQuery = true)
    fun databaseSizeBytes(): Long

    /** Content-addressed keys are shared; never delete an object still in use. */
    @Query("select count(b) from ArticleBodyEntity b where b.storageKey = :storageKey")
    fun countByStorageKey(@Param("storageKey") storageKey: String): Long

    interface ColdRow {
        val articleId: String
        val storageKey: String
    }

    @Query(
        """
        select b.articleId as articleId, b.storageKey as storageKey
          from ArticleBodyEntity b, ArticleEntity a
         where b.articleId = a.id
           and b.storageKey is not null
           and a.fetchedAt < :cutoff
         order by a.fetchedAt asc
        """,
    )
    fun purgeCandidates(@Param("cutoff") cutoff: Instant, page: Pageable): List<ColdRow>

    /** Drop only the cold pointer. The article row and user state are untouched. */
    @Modifying
    @Query(
        """
        update ArticleBodyEntity b
           set b.storageKey = null, b.byteSize = null
         where b.articleId = :articleId and b.storageKey = :storageKey
        """,
    )
    fun clearOffloaded(@Param("articleId") articleId: String, @Param("storageKey") storageKey: String): Int
}
