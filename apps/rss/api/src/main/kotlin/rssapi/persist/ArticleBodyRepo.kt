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
}
