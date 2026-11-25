package timesupapi.interests

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ImportBatchRepo : JpaRepository<ImportBatchEntity, UUID> {
    fun findByUserIdOrderByCreatedAtDesc(userId: UUID): List<ImportBatchEntity>
    fun findByFingerprint(fingerprint: String): ImportBatchEntity?
}
