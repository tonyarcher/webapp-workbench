package rssapi.domain

import java.time.Instant

/**
 * Best signal blends across a cluster's members. Empty clusters score zero
 * (clusters built by [clusterByStory] are never empty; the guard keeps the
 * helper total for direct callers).
 */
fun clusterScores(cluster: Cluster, affinity: Map<String, Float>): Pair<Double, Double> {
    var worthy = 0.0
    var interest = 0.0
    for (article in cluster.articles) {
        val aff = affinitySum(article.feedId, article.domain, article.author, affinity)
        worthy = maxOf(worthy, signalWorthy(article.hot, article.popularity, article.engagement, aff))
        interest = maxOf(interest, signalInterest(article.hot, article.popularity, article.engagement, aff))
    }
    return worthy to interest
}

/** Newest member's recency decay; drives the client newness weight. */
fun clusterNewness(cluster: Cluster, now: Instant, windowHours: Long): Double =
    cluster.articles.maxOfOrNull { newnessOf(it.publishedAt, now, windowHours) } ?: 0.0

/** Best popularity outlook across members; drives the client popularity weight. */
fun clusterPopularity(cluster: Cluster, affinity: Map<String, Float>): Double {
    var best = 0.0
    for (article in cluster.articles) {
        val aff = affinitySum(article.feedId, article.domain, article.author, affinity)
        best = maxOf(best, signalPopularityOutlook(article.hot, article.popularity, article.engagement, aff))
    }
    return best
}
