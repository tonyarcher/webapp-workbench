package fitnessapi.persist

import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository

interface ProfileRepo : JpaRepository<ProfileEntity, UUID>
