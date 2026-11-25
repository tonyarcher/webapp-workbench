package timesupapi.interests

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface SourceRepo : JpaRepository<SourceEntity, UUID> {
    fun findByUserId(userId: UUID): List<SourceEntity>
    fun findByUserIdAndKey(userId: UUID, key: String): SourceEntity?
    fun findByHost(host: String): List<SourceEntity>
}
