package rssapi.provenance

import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import rssapi.articles.ArticleEntity
import java.time.Instant

interface ArticleEvidenceRepo : JpaRepository<ArticleEvidenceEntity, String> {
    fun deleteByArticleId(articleId: String)
    fun findByArticleIdOrderByKindAscIdAsc(articleId: String): List<ArticleEvidenceEntity>
}

interface EvidenceArticleRepo : JpaRepository<ArticleEntity, String> {
    interface Candidate {
        val id: String
        val excerpt: String?
    }

    @Query(
        """
        select a.id as id, a.excerpt as excerpt from ArticleEntity a
         where a.evidenceExtractedAt is null
         order by a.fetchedAt asc
        """,
    )
    fun candidates(page: Pageable): List<Candidate>

    @Modifying
    @Query("update ArticleEntity a set a.evidenceExtractedAt = :now where a.id = :id")
    fun markExtracted(@Param("id") id: String, @Param("now") now: Instant): Int
}
