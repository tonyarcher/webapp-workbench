package stockgame.persist

import org.springframework.data.jpa.repository.JpaRepository

interface GameConfigRepo : JpaRepository<GameConfigEntity, String>
