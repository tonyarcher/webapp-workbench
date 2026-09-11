package rssapi.persist

import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository

interface FolderFeedRepo : JpaRepository<FolderFeedEntity, FolderFeedId> {
    fun findByFeedId(feedId: UUID): List<FolderFeedEntity>
    fun deleteByFeedId(feedId: UUID)
    fun findByFolderId(folderId: UUID): List<FolderFeedEntity>
}
