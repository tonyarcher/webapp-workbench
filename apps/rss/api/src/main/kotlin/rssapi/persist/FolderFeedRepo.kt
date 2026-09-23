package rssapi.persist

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface FolderFeedRepo : JpaRepository<FolderFeedEntity, FolderFeedId> {
    fun findByFeedId(feedId: UUID): List<FolderFeedEntity>
    fun deleteByFeedId(feedId: UUID)
    fun deleteByFeedIdAndFolderIdIn(feedId: UUID, folderIds: Collection<UUID>)
    fun existsByFolderIdAndFeedId(folderId: UUID, feedId: UUID): Boolean
    fun findByFolderId(folderId: UUID): List<FolderFeedEntity>
    fun findByFolderIdIn(folderIds: Collection<UUID>): List<FolderFeedEntity>
    fun findByFeedIdIn(feedIds: Collection<UUID>): List<FolderFeedEntity>
}
