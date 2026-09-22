package radioapi.persist

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.util.UUID

@Entity
@Table(name = "stations")
class StationEntity {
    @Id
    var id: String = ""

    var name: String = ""

    var format: String = ""
}

@Entity
@Table(name = "tracks")
class TrackEntity {
    @Id
    var id: UUID = UUID(0, 0)

    var mbid: String? = null

    var artist: String = ""

    var title: String = ""

    @Column(name = "duration_ms")
    var durationMs: Int = 0

    var year: Int? = null

    var genre: String = ""

    var era: String = ""

    var rotation: String = ""

    var rank: Int = 0

    var explicit: Boolean = false

    @Column(name = "radio_edit")
    var radioEdit: Boolean = true
}
