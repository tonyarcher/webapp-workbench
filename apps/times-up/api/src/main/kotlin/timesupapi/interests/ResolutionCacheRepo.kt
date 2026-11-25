package timesupapi.interests

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ResolutionCacheRepo : JpaRepository<ResolutionCacheEntity, UUID> {
    fun findByLabelKey(labelKey: String): ResolutionCacheEntity?
}
