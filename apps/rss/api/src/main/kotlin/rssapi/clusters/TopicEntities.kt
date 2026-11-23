package rssapi.clusters

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table
import java.io.Serializable
import java.time.Instant

data class ArticleTopicId(var articleId: String = "", var topicKey: String = "") : Serializable {
    companion object {
        private const val serialVersionUID: Long = 1
    }
}

@Entity
@Table(name = "article_topics")
@IdClass(ArticleTopicId::class)
class ArticleTopicEntity(
    @Id
    @Column(name = "article_id")
    var articleId: String = "",
    @Id
    @Column(name = "topic_key")
    var topicKey: String = "",
)

@Entity
@Table(name = "topic_clusters")
class TopicClusterEntity(
    @Id
    var id: String = "",
    var label: String = "",
    @Column(name = "member_count")
    var memberCount: Int = 0,
    @Column(name = "growth_rate")
    var growthRate: Double = 0.0,
    @Column(name = "first_seen")
    var firstSeen: Instant = Instant.now(),
    @Column(name = "last_seen")
    var lastSeen: Instant = Instant.now(),
    @Column(name = "updated_at")
    var updatedAt: Instant = Instant.now(),
)

data class ClusterMemberId(var clusterId: String = "", var articleId: String = "") : Serializable {
    companion object {
        private const val serialVersionUID: Long = 1
    }
}

@Entity
@Table(name = "topic_cluster_members")
@IdClass(ClusterMemberId::class)
class TopicClusterMemberEntity(
    @Id
    @Column(name = "cluster_id")
    var clusterId: String = "",
    @Id
    @Column(name = "article_id")
    var articleId: String = "",
)
