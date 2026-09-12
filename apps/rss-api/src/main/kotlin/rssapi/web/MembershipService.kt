package rssapi.web

import java.util.UUID
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import rssapi.persist.FolderFeedEntity
import rssapi.persist.FolderFeedRepo
import rssapi.persist.FolderRepo

@Service
@Transactional
class MembershipService(
    private val folders: FolderRepo,
    private val memberships: FolderFeedRepo,
) {
    fun addMembership(folderId: UUID, feedId: UUID) {
        if (!memberships.existsByFolderIdAndFeedId(folderId, feedId)) {
            memberships.save(FolderFeedEntity(folderId = folderId, feedId = feedId))
        }
    }

    fun removeOwnMemberships(userId: UUID, feedId: UUID) {
        val owned = folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId).mapNotNull { it.id }
        if (owned.isNotEmpty()) memberships.deleteByFeedIdAndFolderIdIn(feedId, owned)
    }

    fun ownedFolderIds(userId: UUID, feedId: UUID): List<String> {
        val owned = folders.findByUserIdOrderBySortOrderAscCreatedAtAsc(userId).mapNotNull { it.id }.toSet()
        return memberships.findByFeedId(feedId).map { it.folderId }.filter { it in owned }.map { it.toString() }
    }
}
