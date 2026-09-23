package stockgame.persist

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface UserRepo : JpaRepository<UserEntity, UUID> {
    fun findBySubject(subject: String): UserEntity?
}
