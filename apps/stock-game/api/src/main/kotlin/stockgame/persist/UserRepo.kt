package stockgame.persist

import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository

interface UserRepo : JpaRepository<UserEntity, UUID> {
    fun findBySubject(subject: String): UserEntity?
}
