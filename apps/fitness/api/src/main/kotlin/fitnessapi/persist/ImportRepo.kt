package fitnessapi.persist

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ImportRepo : JpaRepository<ImportEntity, UUID>
