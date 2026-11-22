package userapi.persist
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface McpClientRepo : JpaRepository<McpClientEntity, UUID> {
    fun findByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(userId: UUID): List<McpClientEntity>
}
