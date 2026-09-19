package rssapi.domain

import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

private val NOW: Instant = Instant.parse("2026-09-13T12:00:00Z")

private fun editionArticle(
    id: String,
    storyKey: String? = null,
    feedId: UUID = UUID.fromString("11111111-1111-1111-1111-111111111111"),
    hoursAgo: Long = 1,
    hot: Double = 6_300.0,
    popularity: Double = 5.0,
    engagement: Double = 2.0,
    domain: String? = null,
    author: String? = null,
    title: String = "t-$id",
): EditionArticle = EditionArticle(
    id = id,
    feedId = feedId,
    title = title,
    excerpt = "excerpt $id",
    publishedAt = NOW.minusSeconds(hoursAgo * 3_600),
    hot = hot,
    popularity = popularity,
    engagement = engagement,
    domain = domain,
    author = author,
    storyKey = storyKey,
)

class EditionTest {
    @Test
    fun groupsByStoryKeyNewestFirst() {
        val feed = UUID.randomUUID()
        val old = editionArticle("a", storyKey = "s1", feedId = feed, hoursAgo = 5)
        val fresh = editionArticle("b", storyKey = "s1", feedId = feed, hoursAgo = 1)
        val other = editionArticle("c", storyKey = "s2", feedId = feed, hoursAgo = 2)

        val clusters = clusterByStory(listOf(old, fresh, other))

        assertEquals(listOf("s1", "s2"), clusters.map { it.key })
        assertEquals(listOf("b", "a"), clusters[0].articles.map { it.id })
    }

    @Test
    fun nullLinksAlwaysStaySolo() {
        // Same feed, same day, no syndication key: still separate clusters by design.
        val feed = UUID.randomUUID()
        val first = editionArticle("a", storyKey = null, feedId = feed, hoursAgo = 1)
        val second = editionArticle("b", storyKey = null, feedId = feed, hoursAgo = 1)

        val clusters = clusterByStory(listOf(first, second))

        assertEquals(2, clusters.size)
        assertEquals(listOf("solo:a", "solo:b"), clusters.map { it.key })
        assertTrue(clusters.all { it.articles.size == 1 })
    }

    @Test
    fun emptyInputClustersEmpty() {
        assertTrue(clusterByStory(emptyList()).isEmpty())
        assertEquals(0.0, compositeRank(Cluster("s", emptyList()), emptyMap(), RankWeights(0.3, 0.3, 0.25, 0.15)))
    }

    @Test
    fun rankIsDeterministicAndAffinityLifts() {
        val feed = UUID.randomUUID()
        val weights = RankWeights(0.3, 0.3, 0.25, 0.15)
        val bare = Cluster("solo:x", listOf(editionArticle("x", feedId = feed)))
        val liked = Cluster("solo:y", listOf(editionArticle("y", feedId = feed)))
        val affinity = mapOf("aff:feed:$feed" to 20f)

        val first = compositeRank(liked, affinity, weights, NOW, 24)
        val second = compositeRank(liked, affinity, weights, NOW, 24)

        assertEquals(first, second)
        assertTrue(first > compositeRank(bare, emptyMap(), weights, NOW, 24))
    }

    @Test
    fun weightsSteerOrdering() {
        val staleHot = Cluster("solo:old", listOf(editionArticle("old", hoursAgo = 20, popularity = 90.0)))
        val freshCold = Cluster("solo:new", listOf(editionArticle("new", hoursAgo = 1, popularity = 0.0)))
        val affinity = emptyMap<String, Float>()
        val freshOnly = RankWeights(0.0, 0.0, 1.0, 0.0)
        val popularOnly = RankWeights(0.0, 0.0, 0.0, 1.0)

        val freshFirst = sortClusters(listOf(staleHot, freshCold), affinity, freshOnly, NOW, 24)
        val popularFirst = sortClusters(listOf(staleHot, freshCold), affinity, popularOnly, NOW, 24)

        assertEquals("solo:new", freshFirst.first().key)
        assertEquals("solo:old", popularFirst.first().key)
    }

    @Test
    fun zeroWeightsRankZeroAndTiebreakByKey() {
        val weights = RankWeights(0.0, 0.0, 0.0, 0.0)
        val second = Cluster("solo:b", listOf(editionArticle("b")))
        val first = Cluster("solo:a", listOf(editionArticle("a")))

        assertEquals(0.0, compositeRank(first, emptyMap(), weights, NOW, 24))
        val sorted = sortClusters(listOf(second, first), emptyMap(), weights, NOW, 24)
        assertEquals(listOf("solo:a", "solo:b"), sorted.map { it.key })
    }

    @Test
    fun staleNewsDecaysToZeroAndFutureIsFresh() {
        val weights = RankWeights(0.0, 0.0, 1.0, 0.0)
        val ancient = Cluster("solo:old", listOf(editionArticle("old", hoursAgo = 48)))
        val coming = Cluster("solo:new", listOf(editionArticle("new", hoursAgo = -1)))

        assertEquals(0.0, compositeRank(ancient, emptyMap(), weights, NOW, 24))
        assertEquals(1.0, compositeRank(coming, emptyMap(), weights, NOW, 24))
    }

    @Test
    fun zeroWindowKillsNewness() {
        val cluster = Cluster("solo:a", listOf(editionArticle("a", hoursAgo = 0)))
        assertEquals(0.0, compositeRank(cluster, emptyMap(), RankWeights(0.0, 0.0, 1.0, 0.0), NOW, 0))
    }

    @Test
    fun nonFinitePopularityStaysFinite() {
        val cluster = Cluster("solo:a", listOf(
            editionArticle("a", popularity = Double.NaN, engagement = Double.POSITIVE_INFINITY),
        ))
        val score = compositeRank(cluster, emptyMap(), RankWeights(0.25, 0.25, 0.25, 0.25), NOW, 24)
        assertTrue(score.isFinite())
    }

    @Test
    fun affinitySumsAndFloors() {
        val feed = UUID.randomUUID()
        val keys = affinityKeys(feed, "example.com", "Ada")
        assertEquals(listOf("aff:feed:$feed", "aff:domain:example.com", "aff:author:ada"), keys)
        assertEquals(listOf("aff:feed:$feed"), affinityKeys(feed, null, null))

        val full = mapOf("aff:feed:$feed" to 1f, "aff:domain:example.com" to 2f, "aff:author:ada" to 3f)
        assertEquals(6.0, affinitySum(feed, "example.com", "Ada", full))
        assertEquals(0.0, affinitySum(feed, null, null, emptyMap()))
        assertEquals(0.0, affinitySum(feed, null, null, mapOf("aff:feed:$feed" to -50f)))
    }

    @Test
    fun voteTopicPicksModeThenAlphabetical() {
        assertNull(voteTopic(emptyList()))
        assertEquals("Tech", voteTopic(listOf("Sports", "Tech", "Tech")))
        assertEquals("Apples", voteTopic(listOf("Pears", "Apples")))
    }

    @Test
    fun plainExcerptStripsAndCaps() {
        assertEquals("", plainExcerpt(null, 500))
        assertEquals("", plainExcerpt("   ", 500))
        assertEquals("", plainExcerpt("<p>hi</p>", 0))
        assertEquals("hello world", plainExcerpt("<p>hello <b>world</b></p>", 500))
        assertEquals("abcde", plainExcerpt("abcdef", 5))
    }

    @Test
    fun clusterScoresEmptyClusterIsZero() {
        assertEquals(0.0 to 0.0, clusterScores(Cluster("empty", emptyList()), emptyMap()))
    }

    @Test
    fun clusterScoresTakeMemberBest() {
        val weak = editionArticle("w", hot = 1.0, popularity = 1.0, engagement = 0.0)
        val strong = editionArticle("s", hot = 8_000.0, popularity = 9.0, engagement = 3.0)
        val cluster = Cluster("k", listOf(weak, strong))
        val (worthy, interest) = clusterScores(cluster, emptyMap())
        assertEquals(signalWorthy(8_000.0, 9.0, 3.0, 0.0), worthy, 1e-9)
        assertEquals(signalInterest(8_000.0, 9.0, 3.0, 0.0), interest, 1e-9)
    }
}
