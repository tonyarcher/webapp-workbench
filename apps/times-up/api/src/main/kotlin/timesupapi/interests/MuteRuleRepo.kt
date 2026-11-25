package timesupapi.interests

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface MuteRuleRepo : JpaRepository<MuteRuleEntity, UUID> {
    fun findByUserId(userId: UUID): List<MuteRuleEntity>
    fun deleteByUserId(userId: UUID)
}
