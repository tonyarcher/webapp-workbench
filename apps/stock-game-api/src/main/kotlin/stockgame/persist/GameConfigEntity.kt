package stockgame.persist

import java.io.Serializable
import java.util.UUID
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table

data class GameConfigId(
    var userId: UUID = UUID(0, 0),
    var key: String = "",
) : Serializable {
    companion object {
        private const val serialVersionUID: Long = 1
    }
}

@Entity
@Table(name = "game_config")
@IdClass(GameConfigId::class)
class GameConfigEntity(
    @Id
    @Column(name = "user_id")
    var userId: UUID = UUID(0, 0),
    @Id
    var key: String = "game",
    var value: String = "",
)
