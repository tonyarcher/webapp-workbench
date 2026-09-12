package rssapi.persist

import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository

interface FolderFeedRepo : JpaRepository<FolderFeedEntity, FolderFeedId> {
    fun findByFeedId(feedId: UUID): List<FolderFeedEntity>
    fun deleteByFeedId(feedId: UUID)
    fun deleteByFeedIdAndFolderIdIn(feedId: UUID, folderIds: Collection<UUID>)
    fun existsByFolderIdAndFeedId(folderId: UUID, feedId: UUID): Boolean
    fun findByFolderId(folderId: UUID): List<FolderFeedEntity>
}
