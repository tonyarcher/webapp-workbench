package radioapi.persist

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.PostLoad
import jakarta.persistence.PostPersist
import jakarta.persistence.Table
import jakarta.persistence.Transient
import java.time.Instant
import java.util.UUID
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import org.springframework.data.domain.Persistable

@Entity
@Table(name = "playlists")
class PlaylistEntity : Persistable<UUID> {
    @Id
    private var id: UUID = UUID(0, 0)

    @Transient
    private var fresh: Boolean = true

    override fun getId(): UUID = id

    fun setId(value: UUID) {
        id = value
    }

    override fun isNew(): Boolean = fresh

    @PostPersist
    @PostLoad
    fun markLoaded() {
        fresh = false
    }

    @Column(name = "station_id")
    var stationId: String = ""

    var seed: String = ""

    @Column(name = "starts_at")
    var startsAt: Instant = Instant.EPOCH

    @Column(name = "duration_ms")
    var durationMs: Long = 0

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    var weights: String = ""

    @Column(name = "created_at")
    var createdAt: Instant = Instant.EPOCH
}
