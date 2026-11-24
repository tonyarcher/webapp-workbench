package rssapi.feeds

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.platform.ApiException
import rssapi.platform.IdentityUser
import java.util.UUID

class FeedDeleteControllerTest {
    private val user: IdentityUser = mock()
    private val feeds: FeedRepo = mock()
    private val subs: SubscriptionRepo = mock()
    private val memberships: MembershipService = mock()
    private val controller = FeedDeleteController(user, feeds, subs, memberships)
    private val uid = UUID.randomUUID()

    @Test
    fun deletesOnlyOwnedFeeds() {
        val owned = UUID.randomUUID()
        val other = UUID.randomUUID()
        whenever(user.id).thenReturn(uid)
        whenever(subs.findFeedIdsByUserId(uid)).thenReturn(listOf(owned))
        whenever(subs.countByFeedId(owned)).thenReturn(0L)

        controller.deleteMany(IdsBody(listOf(owned.toString(), other.toString(), "not-a-uuid")))

        verify(subs).deleteByUserIdAndFeedId(uid, owned)
        verify(subs, never()).deleteByUserIdAndFeedId(uid, other)
    }

    @Test
    fun keepsFeedWhenAnotherSubscriberRemains() {
        val feedId = UUID.randomUUID()
        whenever(user.id).thenReturn(uid)
        whenever(subs.existsByUserIdAndFeedId(uid, feedId)).thenReturn(true)
        whenever(subs.countByFeedId(feedId)).thenReturn(1L)

        controller.delete(feedId.toString())

        verify(subs).deleteByUserIdAndFeedId(uid, feedId)
        verify(feeds, never()).delete(any())
    }

    @Test
    fun missingOwnershipIs404() {
        val feedId = UUID.randomUUID()
        whenever(user.id).thenReturn(uid)
        whenever(subs.existsByUserIdAndFeedId(uid, feedId)).thenReturn(false)

        val err = org.junit.jupiter.api.assertThrows<ApiException> { controller.delete(feedId.toString()) }

        assertEquals(org.springframework.http.HttpStatus.NOT_FOUND, err.status)
    }

    @Test
    fun invalidBodyIsRejected() {
        val err = org.junit.jupiter.api.assertThrows<ApiException> { controller.deleteMany(IdsBody(null)) }

        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, err.status)
    }
}
