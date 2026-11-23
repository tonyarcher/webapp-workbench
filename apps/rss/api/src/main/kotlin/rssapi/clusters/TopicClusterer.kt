package rssapi.clusters

import java.security.MessageDigest
import java.time.Instant

/**
 * One article's learned metadata. No title, body or excerpt reaches the
 * clusterer: article text is disposable once its topic keys are extracted.
 */
data class ClusterArticle(val id: String, val topicKeys: Set<String>, val publishedAt: Instant)

/** A persistent topic group built only from learned keys. */
data class TopicCluster(
    val id: String,
    val label: String,
    val memberIds: List<String>,
    val growthRate: Double,
    val firstSeen: Instant,
    val lastSeen: Instant,
)

/**
 * Pure key-and-time clustering over one bounded window.
 *
 * Articles join when they share a topic key. Union-find makes the result
 * order-independent; singletons are left out because a topic needs more than
 * one source to be useful. The label is the most frequent learned key, not a
 * stored headline, so no article text is read or rewritten here.
 */
object TopicClusterer {
    private const val ID_HASH_CHARS = 24
    private const val LABEL_CHARS = 120

    fun cluster(articles: List<ClusterArticle>, now: Instant = Instant.now()): List<TopicCluster> =
        groups(articles).map { toCluster(it, now) }.sortedByDescending { it.memberIds.size }

    private fun groups(articles: List<ClusterArticle>): List<List<ClusterArticle>> {
        val parent = articles.associate { it.id to it.id }.toMutableMap()
        val byKey = mutableMapOf<String, MutableList<String>>()
        for (article in articles) {
            for (key in article.topicKeys) byKey.getOrPut(key) { mutableListOf() }.add(article.id)
        }
        for (members in byKey.values) {
            for (i in 1 until members.size) union(parent, members[0], members[i])
        }
        return articles.groupBy { find(parent, it.id) }.values.filter { it.size > 1 }
    }

    private fun toCluster(members: List<ClusterArticle>, now: Instant): TopicCluster {
        val sorted = members.sortedBy { it.publishedAt }
        val keys = members.flatMap { it.topicKeys }.groupingBy { it }.eachCount()
        val label = keys.entries.sortedWith(
            compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key },
        ).first().key.removePrefix("phrase:").removePrefix("link:").take(LABEL_CHARS)
        val keyHash = MessageDigest.getInstance("SHA-256")
            .digest(keys.keys.sorted().joinToString("|").toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        return TopicCluster(
            id = "topic:${keyHash.take(ID_HASH_CHARS)}",
            label = label,
            memberIds = members.map { it.id }.sorted(),
            growthRate = growth(members, now),
            firstSeen = sorted.first().publishedAt,
            lastSeen = sorted.last().publishedAt,
        )
    }

    private fun growth(members: List<ClusterArticle>, now: Instant): Double {
        val cutoff = now.minusSeconds(86_400)
        return members.count { it.publishedAt >= cutoff }.toDouble() / members.size
    }

    private fun find(parent: MutableMap<String, String>, id: String): String {
        var root = id
        while (parent[root] != root) root = parent.getValue(root)
        var node = id
        while (parent[node] != root) {
            val next = parent.getValue(node)
            parent[node] = root
            node = next
        }
        return root
    }

    private fun union(parent: MutableMap<String, String>, a: String, b: String) {
        val ra = find(parent, a)
        val rb = find(parent, b)
        if (ra != rb) parent[rb] = ra
    }
}
