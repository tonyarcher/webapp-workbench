package radioapi.store

import java.time.Instant
import java.util.UUID
import javax.sql.DataSource
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import radioapi.domain.Track
import radioapi.domain.Weights
import radioapi.persist.PlaylistEntryRepo
import radioapi.persist.PlaylistRepo
import radioapi.persist.StationRepo
import radioapi.persist.TrackRepo
import radioapi.service.DuplicatePlaylist
import radioapi.service.EntryRow
import radioapi.service.PlaylistRecords
import radioapi.service.PlaylistRow
import radioapi.service.StationRow

@Component
@ConditionalOnBean(DataSource::class)
class JpaPlaylistRecords(
    private val stations: StationRepo,
    private val tracks: TrackRepo,
    private val playlists: PlaylistRepo,
    private val entries: PlaylistEntryRepo,
) : PlaylistRecords {
    override fun stations(): List<StationRow> =
        stations.findAllByOrderByNameAsc().map { StationRow(it.id, it.name, it.format) }

    override fun tracks(): List<Track> = tracks.findAllByOrderByRotationAscRankAsc().map { it.toTrack() }

    override fun find(stationId: String, seed: String, startsAtMs: Long, weightsJson: String): PlaylistRow? {
        val raw = playlists.findSameId(stationId, seed, Instant.ofEpochMilli(startsAtMs), weightsJson) ?: return null
        return playlists.findById(UUID.fromString(raw)).orElse(null)?.toRow(stationName(stationId))
    }

    override fun findById(id: UUID): PlaylistRow? {
        val entity = playlists.findById(id).orElse(null) ?: return null
        return entity.toRow(stationName(entity.stationId))
    }

    override fun entries(id: UUID): List<EntryRow> {
        val byId = tracks.findAll().associateBy { it.id }
        return entries.findAllByIdPlaylistIdOrderByIdIdxAsc(id).map { it.toRow(byId[it.trackId]) }
    }

    @Transactional
    override fun insert(
        stationId: String,
        seed: String,
        startsAtMs: Long,
        weights: Weights,
        entries: List<EntryRow>,
    ): PlaylistRow = saveWeek(stationId, seed, startsAtMs, weights, entries)

    private fun saveWeek(
        stationId: String,
        seed: String,
        startsAtMs: Long,
        weights: Weights,
        rows: List<EntryRow>,
    ): PlaylistRow {
        return try {
            val saved = playlists.save(newPlaylist(stationId, seed, startsAtMs, weights))
            entries.saveAll(rows.map { row -> newEntry(saved.getId(), row) })
            playlists.flush()
            saved.toRow(stationName(stationId))
        } catch (_: DataIntegrityViolationException) {
            throw DuplicatePlaylist()
        }
    }

    private fun stationName(stationId: String): String = stations.findById(stationId).orElse(null)?.name ?: stationId
}
