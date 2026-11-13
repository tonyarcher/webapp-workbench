package rssapi.persist

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface SavedSearchRepo : JpaRepository<SavedSearchEntity, UUID> {
    fun findByUserIdOrderBySortOrderAscCreatedAtAsc(userId: UUID): List<SavedSearchEntity>
    fun findByUserIdAndId(userId: UUID, id: UUID): SavedSearchEntity?
    fun findByUserIdAndIdIn(userId: UUID, ids: Collection<UUID>): List<SavedSearchEntity>
}
