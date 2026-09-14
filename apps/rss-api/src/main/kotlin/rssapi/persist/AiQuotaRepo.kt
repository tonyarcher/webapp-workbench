package rssapi.persist

import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository

interface AiQuotaRepo : JpaRepository<AiQuotaEntity, UUID>
