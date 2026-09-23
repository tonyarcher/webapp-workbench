package rssapi.persist

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface FolderRepo : JpaRepository<FolderEntity, UUID> {
    fun findByUserIdOrderBySortOrderAscCreatedAtAsc(userId: UUID): List<FolderEntity>
    fun findByUserIdAndTitle(userId: UUID, title: String): FolderEntity?
    fun findByUserIdAndIdIn(userId: UUID, ids: Collection<UUID>): List<FolderEntity>
}
