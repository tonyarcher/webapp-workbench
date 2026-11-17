package rssapi.persist

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface BoardRepo : JpaRepository<BoardEntity, UUID> {
    fun findByUserIdOrderBySortOrderAscCreatedAtAsc(userId: UUID): List<BoardEntity>
    fun findByUserIdAndTitle(userId: UUID, title: String): BoardEntity?
    fun findByUserIdAndId(userId: UUID, id: UUID): BoardEntity?
}
