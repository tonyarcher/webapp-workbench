package radioapi.service

import java.util.UUID
import radioapi.domain.Track
import radioapi.domain.Weights

data class StationRow(val id: String, val name: String, val format: String)

data class PlaylistRow(
    val id: UUID,
    val stationId: String,
    val stationName: String,
    val seed: String,
    val startsAt: Long,
    val durationMs: Long,
    val weights: Weights,
    val createdAt: Long,
)

data class EntryRow(
    val idx: Int,
    val trackId: String,
    val artist: String,
    val title: String,
    val startsAt: Long,
    val durationMs: Int,
    val rotation: String,
    val era: String,
)

interface PlaylistRecords {
    fun stations(): List<StationRow>

    fun tracks(): List<Track>

    fun find(stationId: String, seed: String, startsAtMs: Long, weightsJson: String): PlaylistRow?

    fun insert(
        stationId: String,
        seed: String,
        startsAtMs: Long,
        weights: Weights,
        entries: List<EntryRow>,
    ): PlaylistRow

    fun entries(id: UUID): List<EntryRow>

    fun findById(id: UUID): PlaylistRow?
}
