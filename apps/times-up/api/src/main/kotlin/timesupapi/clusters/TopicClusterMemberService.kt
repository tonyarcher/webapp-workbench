package timesupapi.clusters

import org.springframework.data.domain.PageRequest
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import timesupapi.feeds.SubscriptionRepo
import timesupapi.platform.ApiException
import java.util.UUID

/** Subscriber-owned member rows for one learned topic cluster. */
@Service
class TopicClusterMemberService(
    private val clusters: TopicClusterRepo,
    private val members: TopicClusterMemberRepo,
    private val subscriptions: SubscriptionRepo,
) {
    fun members(clusterId: String, userId: UUID, limit: Int): List<TopicClusterMemberRepo.MemberRow> {
        if (!clusters.existsById(clusterId)) throw ApiException(HttpStatus.NOT_FOUND, "Cluster not found")
        val feedIds = subscriptions.findFeedIdsByUserId(userId)
        if (feedIds.isEmpty()) return emptyList()
        val page = PageRequest.of(0, limit.coerceIn(1, MAX_MEMBERS))
        return members.findMemberRows(clusterId, feedIds, page)
    }

    private companion object {
        const val MAX_MEMBERS = 50
    }
}
