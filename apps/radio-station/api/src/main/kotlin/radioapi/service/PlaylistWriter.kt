package radioapi.service

import java.util.UUID
import radioapi.domain.GenerateCommand
import radioapi.domain.ScheduledEntry
import radioapi.domain.generateWeek
import radioapi.domain.weightsJson

class UnknownStation : RuntimeException("unknown station")

class DuplicatePlaylist : RuntimeException("duplicate playlist")

data class GeneratedWeek(val playlist: PlaylistRow, val entries: List<EntryRow>)

class PlaylistWriter(private val records: PlaylistRecords) {
    fun stations(): List<StationRow> = records.stations()

    fun playlist(id: UUID): PlaylistRow? = records.findById(id)

    fun entries(id: UUID): List<EntryRow>? {
        if (records.findById(id) == null) return null
        return records.entries(id)
    }

    fun generate(command: GenerateCommand): GeneratedWeek {
        if (records.stations().none { it.id == command.stationId }) throw UnknownStation()
        return reuseOrInsert(command)
    }

    private fun reuseOrInsert(command: GenerateCommand): GeneratedWeek {
        val weights = weightsJson(command.weights)
        val existing = records.find(command.stationId, command.seed, command.startsAtMs, weights)
        if (existing != null) return GeneratedWeek(existing, records.entries(existing.id))
        val scheduled = generateWeek(records.tracks(), command.seed, command.startsAtMs, command.weights)
        return insertOrRaced(command, weights, scheduled)
    }

    private fun insertOrRaced(
        command: GenerateCommand,
        weights: String,
        scheduled: List<ScheduledEntry>,
    ): GeneratedWeek {
        return try {
            val rows = toRows(scheduled)
            val playlist = records.insert(command.stationId, command.seed, command.startsAtMs, command.weights, rows)
            GeneratedWeek(playlist, rows)
        } catch (_: DuplicatePlaylist) {
            raced(command, weights)
        }
    }

    private fun raced(command: GenerateCommand, weights: String): GeneratedWeek {
        val found = records.find(command.stationId, command.seed, command.startsAtMs, weights)
            ?: throw DuplicatePlaylist()
        return GeneratedWeek(found, records.entries(found.id))
    }
}

private fun toRows(scheduled: List<ScheduledEntry>): List<EntryRow> =
    scheduled.mapIndexed { index, entry ->
        EntryRow(
            idx = index,
            trackId = entry.trackId,
            artist = entry.artist,
            title = entry.title,
            startsAt = entry.startsAtMs,
            durationMs = entry.durationMs,
            rotation = entry.rotation,
            era = entry.era,
        )
    }
