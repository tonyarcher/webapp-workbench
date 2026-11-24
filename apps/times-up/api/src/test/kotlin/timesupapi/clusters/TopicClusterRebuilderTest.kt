package timesupapi.clusters

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.Instant
import java.util.Optional

class TopicClusterRebuilderTest {
    private val topics: ArticleTopicRepo = mock()
    private val clusters: TopicClusterRepo = mock()
    private val members: TopicClusterMemberRepo = mock()
    private val rebuilder = TopicClusterRebuilder(topics, clusters, members)
    private val now = Instant.parse("2026-11-23T00:00:00Z")

    private fun row(articleId: String, key: String) = object : ArticleTopicRepo.TopicRow {
        override val articleId = articleId
        override val topicKey = key
        override val publishedAt = now
    }

    @Test
    fun persistsDesiredClusterAndRemovesStaleOnes() {
        whenever(
            topics.recent(any(), any()),
        ).thenReturn(listOf(row("a1", "phrase:battery grid"), row("a2", "phrase:battery grid")))
        val agedOut = TopicClusterEntity(id = "old", lastSeen = now.minusSeconds(900_000))
        val live = TopicClusterEntity(id = "live", lastSeen = now)
        whenever(clusters.findAll()).thenReturn(listOf(agedOut, live))

        rebuilder.rebuild(now)

        verify(clusters).delete(agedOut)
        verify(clusters, org.mockito.kotlin.never()).delete(live)
        val saved = argumentCaptor<TopicClusterEntity>()
        verify(clusters).save(saved.capture())
        assertEquals(2, saved.firstValue.memberCount)
        assertEquals("battery grid", saved.firstValue.label)
        val rows = argumentCaptor<List<TopicClusterMemberEntity>>()
        verify(members).saveAll(rows.capture())
        assertEquals(listOf("a1", "a2"), rows.firstValue.map { it.articleId })
    }

    @Test
    fun supersededClusterSharingMembersIsDeleted() {
        whenever(
            topics.recent(any(), any()),
        ).thenReturn(listOf(row("a1", "phrase:battery grid"), row("a2", "phrase:battery grid")))
        val old = TopicClusterEntity(id = "old", lastSeen = now)
        whenever(clusters.findAll()).thenReturn(listOf(old))
        whenever(members.findByClusterId("old")).thenReturn(listOf(TopicClusterMemberEntity("old", "a1")))

        rebuilder.rebuild(now)

        verify(clusters).delete(old)
    }

    @Test
    fun emptyWindowProducesNoClusters() {
        whenever(topics.recent(any(), any())).thenReturn(emptyList())

        rebuilder.rebuild(now)

        verify(clusters, org.mockito.kotlin.never()).save(any())
    }

    @Test
    fun clusterWithoutAStoredRowIsCreated() {
        whenever(
            topics.recent(any(), any()),
        ).thenReturn(listOf(row("a1", "phrase:battery grid"), row("a2", "phrase:battery grid")))
        whenever(clusters.findAll()).thenReturn(emptyList())
        whenever(clusters.findById(any())).thenReturn(Optional.empty())

        rebuilder.rebuild(now)

        verify(clusters).save(any())
    }

    @Test
    fun stoppedRebuilderDoesNothing() {
        rebuilder.stop()

        rebuilder.rebuild(now)

        verify(topics, never()).recent(any(), any())
    }
}
