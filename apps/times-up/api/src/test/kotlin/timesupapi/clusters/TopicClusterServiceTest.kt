package timesupapi.clusters

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.Optional

class TopicClusterServiceTest {
    private val clusters: TopicClusterRepo = mock()
    private val members: TopicClusterMemberRepo = mock()
    private val service = TopicClusterService(clusters, members)
    private val cluster = TopicClusterEntity(id = "topic:1", label = "grid")

    @Test
    fun topReturnsTheClusters() {
        whenever(
            clusters.findAll(org.mockito.kotlin.any<org.springframework.data.domain.Sort>()),
        ).thenReturn(listOf(cluster))

        assertEquals(listOf(cluster), service.top(3))
    }

    @Test
    fun forArticleReturnsItsCluster() {
        whenever(members.findCurrentByArticleId("a1")).thenReturn(listOf(TopicClusterMemberEntity("topic:1", "a1")))
        whenever(clusters.findById("topic:1")).thenReturn(Optional.of(cluster))

        assertEquals(cluster, service.forArticle("a1"))
    }

    @Test
    fun articleWithoutMembershipHasNoCluster() {
        whenever(members.findCurrentByArticleId("a1")).thenReturn(emptyList())

        assertNull(service.forArticle("a1"))
    }

    @Test
    fun missingClusterRowIsNull() {
        whenever(members.findCurrentByArticleId("a1")).thenReturn(listOf(TopicClusterMemberEntity("topic:1", "a1")))
        whenever(clusters.findById("topic:1")).thenReturn(Optional.empty())

        assertNull(service.forArticle("a1"))
    }
}
