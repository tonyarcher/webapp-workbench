package rssapi.web

import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import rssapi.persist.FolderEntity
import rssapi.persist.FolderFeedEntity
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class MembershipServiceTest {
    private val folders: FolderRepo = mock()
    private val memberships: FolderFeedRepo = mock()
    private val service = MembershipService(folders, memberships)
    private val userId = UUID.randomUUID()
    private val folderId = UUID.randomUUID()
    private val feedId = UUID.randomUUID()

    @Test
    fun addSkipsWhenExists() {
        whenever(memberships.existsByFolderIdAndFeedId(folderId, feedId)).thenReturn(true)
        service.addMembership(folderId, feedId)
        verify(memberships, never()).save(any())
    }

    @Test
    fun addSavesWhenMissing() {
        whenever(memberships.existsByFolderIdAndFeedId(folderId, feedId)).thenReturn(false)
        service.addMembership(folderId, feedId)
        verify(memberships).save(any())
    }

    @Test
    fun removeSkipsWhenNoOwned() {
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId)).thenReturn(emptyList())
        service.removeOwnMemberships(userId, feedId)
        verify(memberships, never()).deleteByFeedIdAndFolderIdIn(any(), any())
    }

    @Test
    fun ownedFiltersToUserFolders() {
        val other = UUID.randomUUID()
        whenever(folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId)).thenReturn(
            listOf(FolderEntity(id = folderId, userId = userId, title = "N")),
        )
        whenever(memberships.findByFeedId(feedId)).thenReturn(
            listOf(
                FolderFeedEntity(folderId = folderId, feedId = feedId),
                FolderFeedEntity(folderId = other, feedId = feedId),
            ),
        )
        val owned = service.ownedFolderIds(userId, feedId)
        assertEquals(listOf(folderId.toString()), owned)
        assertTrue(owned.none { it == other.toString() })
    }
}
