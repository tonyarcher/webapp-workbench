package timesupapi.clusters

import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import timesupapi.articles.ArticleEntity
import java.time.Instant
import java.util.UUID

interface TopicArticleRepo : JpaRepository<ArticleEntity, String> {
    interface Candidate {
        val id: String
        val title: String
        val normLink: String?
        val canonicalUrl: String?
        val sourceUrl: String?
    }

    @Query(
        """
        select a.id as id, a.title as title, a.normLink as normLink,
               a.canonicalUrl as canonicalUrl, a.sourceUrl as sourceUrl
          from ArticleEntity a
         where a.topicsExtractedAt is null
         order by a.fetchedAt asc
        """,
    )
    fun candidates(page: Pageable): List<Candidate>

    @Modifying
    @Query("update ArticleEntity a set a.topicsExtractedAt = :now where a.id = :id")
    fun markExtracted(@Param("id") id: String, @Param("now") now: Instant): Int
}

interface ArticleTopicRepo : JpaRepository<ArticleTopicEntity, ArticleTopicId> {
    fun deleteByArticleId(articleId: String)

    interface TopicRow {
        val articleId: String
        val topicKey: String
        val publishedAt: Instant
    }

    @Query(
        """
        select t.articleId as articleId, t.topicKey as topicKey, a.publishedAt as publishedAt
          from ArticleTopicEntity t join ArticleEntity a on a.id = t.articleId
         where a.publishedAt >= :since
        """,
    )
    fun recent(@Param("since") since: Instant, page: Pageable): List<TopicRow>
}

interface TopicClusterRepo : JpaRepository<TopicClusterEntity, String>

interface TopicClusterMemberRepo : JpaRepository<TopicClusterMemberEntity, ClusterMemberId> {
    fun deleteByClusterId(clusterId: String)
    fun findByArticleId(articleId: String): List<TopicClusterMemberEntity>
    fun findByClusterId(clusterId: String): List<TopicClusterMemberEntity>

    interface MemberRow {
        val id: String
        val title: String
        val feedId: UUID
        val publishedAt: Instant
    }

    @Query(
        """
        select a.id as id, a.title as title, a.feedId as feedId, a.publishedAt as publishedAt
          from TopicClusterMemberEntity m join ArticleEntity a on a.id = m.articleId
         where m.clusterId = :clusterId and a.feedId in :feedIds
         order by a.publishedAt desc
        """,
    )
    fun findMemberRows(
        @Param("clusterId") clusterId: String,
        @Param("feedIds") feedIds: Collection<UUID>,
        page: Pageable,
    ): List<MemberRow>

    @Query(
        """
        select m from TopicClusterMemberEntity m join TopicClusterEntity c on c.id = m.clusterId
         where m.articleId = :articleId order by c.updatedAt desc
        """,
    )
    fun findCurrentByArticleId(@Param("articleId") articleId: String): List<TopicClusterMemberEntity>
}
