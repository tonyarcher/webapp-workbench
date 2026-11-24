package timesupapi.clusters

import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service

/** Reads learned clusters. No article text is involved. */
@Service
class TopicClusterService(private val clusters: TopicClusterRepo, private val members: TopicClusterMemberRepo) {
    fun top(limit: Int): List<TopicClusterEntity> =
        clusters.findAll(Sort.by(Sort.Direction.DESC, "growthRate")).take(limit)

    fun forArticle(articleId: String): TopicClusterEntity? =
        members.findCurrentByArticleId(articleId).firstOrNull()?.let { clusters.findById(it.clusterId).orElse(null) }
}
