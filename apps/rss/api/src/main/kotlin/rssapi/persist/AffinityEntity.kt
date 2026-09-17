package rssapi.persist

import java.io.Serializable
import java.time.Instant
import java.util.UUID
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.Table

data class AffinityId(
    var userId: UUID = UUID(0, 0),
    var key: String = "",
) : Serializable {
    companion object {
        private const val serialVersionUID: Long = 1
    }
}

@Entity
@Table(name = "user_affinity")
@IdClass(AffinityId::class)
class AffinityEntity(
    @Id @Column(name = "user_id")
    var userId: UUID = UUID(0, 0),
    @Id
    var key: String = "",
    var value: Float = 0f,
    @Column(name = "updated_at")
    var updatedAt: Instant = Instant.now(),
)
