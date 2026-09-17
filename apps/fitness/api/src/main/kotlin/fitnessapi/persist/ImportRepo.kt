package fitnessapi.persist

import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository

interface ImportRepo : JpaRepository<ImportEntity, UUID>
