package stockgame.persist

import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "game_config")
class GameConfigEntity(
    @Id
    var key: String = "game",
    var value: String = "",
)
