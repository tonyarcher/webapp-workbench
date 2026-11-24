package timesupapi.feeds

import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import timesupapi.platform.ApiException
import timesupapi.platform.IdentityUser
import timesupapi.platform.isUuid
import java.util.UUID

/** Removes subscriptions. Deleting the last one removes the shared feed row and its articles. */
@RestController
class FeedDeleteController(
    private val user: IdentityUser,
    private val feeds: FeedRepo,
    private val subs: SubscriptionRepo,
    private val membershipService: MembershipService,
) {
    @DeleteMapping("/feeds", headers = ["X-Api-Version=1"])
    @Transactional
    fun deleteMany(@RequestBody body: IdsBody): OkBody {
        val ids = (body.ids ?: throw ApiException(HttpStatus.BAD_REQUEST, "ids array is required"))
            .filter { isUuid(it) }
            .map { UUID.fromString(it) }
            .distinct()
        val owned = subs.findFeedIdsByUserId(user.id).toSet()
        for (feedId in ids.filter { it in owned }) deleteOwned(feedId)
        return OkBody()
    }

    @DeleteMapping("/feeds/{id}", headers = ["X-Api-Version=1"])
    @Transactional
    fun delete(@PathVariable id: String): OkBody {
        if (!isUuid(id)) throw ApiException(HttpStatus.BAD_REQUEST, "invalid feed id")
        val feedId = UUID.fromString(id)
        if (!subs.existsByUserIdAndFeedId(user.id, feedId)) {
            throw ApiException(HttpStatus.NOT_FOUND, "Feed not found")
        }
        deleteOwned(feedId)
        return OkBody()
    }

    private fun deleteOwned(feedId: UUID) {
        subs.deleteByUserIdAndFeedId(user.id, feedId)
        membershipService.removeOwnMemberships(user.id, feedId)
        if (subs.countByFeedId(feedId) == 0L) {
            feeds.findById(feedId).ifPresent { feeds.delete(it) }
        }
    }
}
