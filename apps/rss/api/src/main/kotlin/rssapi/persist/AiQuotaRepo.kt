package rssapi.persist

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface AiQuotaRepo : JpaRepository<AiQuotaEntity, UUID>
