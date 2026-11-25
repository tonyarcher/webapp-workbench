package timesupapi.interests

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface InterestRepo : JpaRepository<InterestEntity, UUID> {
    fun findByUserIdOrderByWeightDesc(userId: UUID): List<InterestEntity>
    fun findByUserIdAndKindAndKey(userId: UUID, kind: String, key: String): InterestEntity?
    fun findByUserIdAndEnabled(userId: UUID, enabled: Boolean): List<InterestEntity>
}
