package timesupapi.clusters

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageRequest
import org.springframework.http.HttpStatus
import timesupapi.feeds.SubscriptionRepo
import timesupapi.platform.ApiException
import java.util.UUID
import kotlin.test.Test

class TopicClusterMemberServiceTest {
    private val clusters: TopicClusterRepo = mock()
    private val members: TopicClusterMemberRepo = mock()
    private val subscriptions: SubscriptionRepo = mock()
    private val service = TopicClusterMemberService(clusters, members, subscriptions)
    private val userId = UUID.randomUUID()
    private val feedId = UUID.randomUUID()

    @Test
    fun returnsOnlyRowsFromTheUsersSubscribedFeeds() {
        val row: TopicClusterMemberRepo.MemberRow = mock()
        whenever(clusters.existsById("topic:1")).thenReturn(true)
        whenever(subscriptions.findFeedIdsByUserId(userId)).thenReturn(listOf(feedId))
        whenever(members.findMemberRows("topic:1", listOf(feedId), PageRequest.of(0, 20))).thenReturn(listOf(row))

        assertEquals(listOf(row), service.members("topic:1", userId, 20))
        verify(members).findMemberRows("topic:1", listOf(feedId), PageRequest.of(0, 20))
    }

    @Test
    fun noSubscriptionsMeansNoMemberRows() {
        whenever(clusters.existsById("topic:1")).thenReturn(true)
        whenever(subscriptions.findFeedIdsByUserId(userId)).thenReturn(emptyList())

        assertTrue(service.members("topic:1", userId, 20).isEmpty())
    }

    @Test
    fun missingClusterIs404() {
        whenever(clusters.existsById("missing")).thenReturn(false)

        val err = assertThrows<ApiException> { service.members("missing", userId, 20) }

        assertEquals(HttpStatus.NOT_FOUND, err.status)
    }
}
