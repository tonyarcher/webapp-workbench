package fitnessapi.persist

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ProfileRepo : JpaRepository<ProfileEntity, UUID>
