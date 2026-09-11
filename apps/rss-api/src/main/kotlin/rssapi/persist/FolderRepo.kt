package rssapi.persist

import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository

interface FolderRepo : JpaRepository<FolderEntity, UUID> {
    fun findByUserIdOrderBySortOrderAscCreatedAtAsc(userId: UUID): List<FolderEntity>
    fun findByUserIdAndTitle(userId: UUID, title: String): FolderEntity?
    fun findByUserIdAndIdIn(userId: UUID, ids: Collection<UUID>): List<FolderEntity>
}
