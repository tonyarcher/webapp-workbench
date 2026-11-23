package rssapi.clusters

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant

class TopicClustererTest {
    private val now = Instant.parse("2026-11-23T00:00:00Z")

    private fun article(id: String, keys: Set<String>, ageHours: Long = 1) = ClusterArticle(
        id = id,
        topicKeys = keys,
        publishedAt = now.minusSeconds(ageHours * 3600),
    )

    @Test
    fun sharedKeysMergeIntoOneCluster() {
        val result = TopicClusterer.cluster(
            listOf(
                article("a1", setOf("phrase:battery grid", "link:https://x/story")),
                article("a2", setOf("phrase:battery grid")),
            ),
            now,
        )

        assertEquals(1, result.size)
        assertEquals(listOf("a1", "a2"), result.single().memberIds)
        assertEquals("battery grid", result.single().label)
        assertEquals(1.0, result.single().growthRate)
    }

    @Test
    fun singletonsAreDropped() {
        val result = TopicClusterer.cluster(
            listOf(article("a1", setOf("phrase:solo topic")), article("a2", setOf("phrase:other topic"))),
            now,
        )

        assertTrue(result.isEmpty())
    }

    @Test
    fun idsAreStableForTheSameKeys() {
        val input = listOf(
            article("a1", setOf("phrase:battery grid"), 30),
            article("a2", setOf("phrase:battery grid"), 30),
        )

        val first = TopicClusterer.cluster(input, now).single().id
        val second = TopicClusterer.cluster(input.reversed(), now).single().id

        assertEquals(first, second)
        assertTrue(first.startsWith("topic:"))
    }

    @Test
    fun alreadyMergedArticlesDoNotChangeTheUnion() {
        val input = listOf(
            article("a1", setOf("link:x", "phrase:battery grid")),
            article("a2", setOf("link:x", "phrase:grid storage")),
            article("a3", setOf("phrase:battery grid", "phrase:grid storage")),
        )

        assertEquals(1, TopicClusterer.cluster(input, now).size)
    }

    @Test
    fun growthUsesTheRecentWindow() {
        val result = TopicClusterer.cluster(
            listOf(
                article("a1", setOf("link:https://x/story"), 1),
                article("a2", setOf("link:https://x/story"), 200),
            ),
            now,
        ).single()

        assertEquals(0.5, result.growthRate)
    }
}
