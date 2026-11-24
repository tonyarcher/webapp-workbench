package timesupapi.clusters

import jakarta.annotation.PreDestroy
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import timesupapi.platform.log.log
import java.time.Duration
import java.time.Instant

private const val WINDOW_DAYS = 7L
private const val MAX_ROWS = 20_000

/** Rebuilds persistent topic groups from learned keys only. */
@Component
class TopicClusterRebuilder(
    private val topics: ArticleTopicRepo,
    private val clusters: TopicClusterRepo,
    private val members: TopicClusterMemberRepo,
) {
    @Volatile private var stopped = false

    @PreDestroy
    fun stop() {
        stopped = true
    }

    @Scheduled(fixedDelayString = "\${TOPIC_CLUSTER_MS:900000}")
    @Transactional
    fun rebuild() = rebuild(Instant.now())

    internal fun rebuild(now: Instant) {
        if (stopped) return
        val since = now.minus(Duration.ofDays(WINDOW_DAYS))
        val rows = topics.recent(since, PageRequest.of(0, MAX_ROWS))
        val articles = rows.groupBy { it.articleId }.map { (id, keys) ->
            ClusterArticle(id, keys.map { it.topicKey }.toSet(), keys.first().publishedAt)
        }
        val desired = TopicClusterer.cluster(articles, now)
        deleteStale(desired.map { it.id }.toSet(), since, desired.flatMap { it.memberIds }.toSet())
        for (cluster in desired) upsert(cluster, now)
        log("times-up-api", "info", "topic clusters rebuilt", mapOf("clusters" to desired.size.toString()))
    }

    /**
     * Delete a stored cluster when it is superseded by a rebuilt one that
     * shares any member, or when it has aged out of the window. A cluster with
     * no overlap and a recent last-seen is kept: the candidate query is capped,
     * so absence from this rebuild does not mean the topic is gone.
     */
    private fun deleteStale(keep: Set<String>, since: Instant, desiredMembers: Set<String>) {
        for (old in clusters.findAll()) {
            if (old.id in keep) continue
            val overlaps = members.findByClusterId(old.id).any { it.articleId in desiredMembers }
            if (overlaps || old.lastSeen < since) clusters.delete(old)
        }
    }

    private fun upsert(cluster: TopicCluster, now: Instant) {
        val row = clusters.findById(cluster.id).orElse(null) ?: TopicClusterEntity(id = cluster.id)
        row.label = cluster.label
        row.memberCount = cluster.memberIds.size
        row.growthRate = cluster.growthRate
        row.firstSeen = cluster.firstSeen
        row.lastSeen = cluster.lastSeen
        row.updatedAt = now
        clusters.save(row)
        members.deleteByClusterId(cluster.id)
        members.saveAll(cluster.memberIds.map { TopicClusterMemberEntity(cluster.id, it) })
    }
}
