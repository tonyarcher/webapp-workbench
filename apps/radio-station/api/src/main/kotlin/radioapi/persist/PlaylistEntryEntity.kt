package radioapi.persist

import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.PostLoad
import jakarta.persistence.PostPersist
import jakarta.persistence.Table
import jakarta.persistence.Transient
import org.springframework.data.domain.Persistable
import java.io.Serializable
import java.time.Instant
import java.util.UUID

@Embeddable
class PlaylistEntryKey : Serializable {
    companion object {
        private const val serialVersionUID: Long = 1L
    }
    @Column(name = "playlist_id")
    var playlistId: UUID = UUID(0, 0)

    var idx: Int = 0

    override fun equals(other: Any?): Boolean {
        if (other !is PlaylistEntryKey) return false
        return playlistId == other.playlistId && idx == other.idx
    }

    override fun hashCode(): Int = playlistId.hashCode() * 31 + idx
}

@Entity
@Table(name = "playlist_entries")
class PlaylistEntryEntity : Persistable<PlaylistEntryKey> {
    @EmbeddedId
    private var id: PlaylistEntryKey = PlaylistEntryKey()

    @Transient
    private var fresh: Boolean = true

    override fun getId(): PlaylistEntryKey = id

    fun setId(value: PlaylistEntryKey) {
        id = value
    }

    override fun isNew(): Boolean = fresh

    @PostPersist
    @PostLoad
    fun markLoaded() {
        fresh = false
    }

    @Column(name = "track_id")
    var trackId: UUID = UUID(0, 0)

    @Column(name = "starts_at")
    var startsAt: Instant = Instant.EPOCH

    @Column(name = "duration_ms")
    var durationMs: Int = 0
}
