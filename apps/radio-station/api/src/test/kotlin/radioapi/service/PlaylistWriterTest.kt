package radioapi.service

import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue
import radioapi.domain.DEFAULT_WEIGHTS
import radioapi.domain.GenerateCommand
import radioapi.domain.Track
import radioapi.domain.weightsJson

class PlaylistWriterTest {
    @Test
    fun unknownStationIsRejected() {
        val writer = PlaylistWriter(FakeRecords())
        assertFailsWith<UnknownStation> { writer.generate(command("missing")) }
    }

    @Test
    fun existingPlaylistIsReused() {
        val records = FakeRecords(stations = listOf(StationRow("top40", "Pulse 101", "Top 40")))
        val existing = samplePlaylist()
        records.stored = existing
        val week = PlaylistWriter(records).generate(command("top40"))
        assertEquals(existing.id, week.playlist.id)
        assertEquals(0, records.inserts)
    }

    @Test
    fun missingPlaylistIs404() {
        val writer = PlaylistWriter(FakeRecords())
        assertNull(writer.playlist(UUID.randomUUID()))
        assertNull(writer.entries(UUID.randomUUID()))
    }

    @Test
    fun insertPersistsGeneratedRows() {
        val stations = listOf(StationRow("top40", "Pulse 101", "Top 40"))
        val records = FakeRecords(stations = stations, tracks = listOf(sampleTrack()))
        val week = PlaylistWriter(records).generate(command("top40"))
        assertEquals(1, records.inserts)
        assertTrue(week.entries.isNotEmpty())
    }

    @Test
    fun duplicateInsertReturnsTheRacedRow() {
        val stations = listOf(StationRow("top40", "Pulse 101", "Top 40"))
        val records = FakeRecords(stations = stations, tracks = listOf(sampleTrack()))
        records.failInsert = true
        records.storedAfterFail = samplePlaylist()
        val week = PlaylistWriter(records).generate(command("top40"))
        assertEquals(records.storedAfterFail?.id, week.playlist.id)
        records.storedAfterFail = null
        assertFailsWith<DuplicatePlaylist> { PlaylistWriter(records).generate(command("top40")) }
    }
}

private fun command(stationId: String) = GenerateCommand(stationId, "seed", 0L, DEFAULT_WEIGHTS)

private fun sampleTrack() = Track("t", "A", "Song", 180_000, 2024, "pop", "current", "power", 1, false, true)

private fun samplePlaylist() = PlaylistRow(
    id = UUID.fromString("00000000-0000-4000-8000-000000000099"),
    stationId = "top40",
    stationName = "Pulse 101",
    seed = "seed",
    startsAt = 0L,
    durationMs = 1L,
    weights = DEFAULT_WEIGHTS,
    createdAt = 0L,
)

private class FakeRecords(
    private val stations: List<StationRow> = emptyList(),
    private val tracks: List<Track> = emptyList(),
) : PlaylistRecords {
    var stored: PlaylistRow? = null
    var storedAfterFail: PlaylistRow? = null
    var failInsert: Boolean = false
    var inserts: Int = 0

    override fun stations(): List<StationRow> = stations

    override fun tracks(): List<Track> = tracks

    override fun find(stationId: String, seed: String, startsAtMs: Long, weightsJson: String): PlaylistRow? {
        val row = stored
        if (row == null) return if (failInsert) storedAfterFail else null
        return row
    }

    override fun insert(
        stationId: String,
        seed: String,
        startsAtMs: Long,
        weights: radioapi.domain.Weights,
        entries: List<EntryRow>,
    ): PlaylistRow {
        inserts += 1
        if (failInsert) throw DuplicatePlaylist()
        return samplePlaylist()
    }

    override fun entries(id: UUID): List<EntryRow> = emptyList()

    override fun findById(id: UUID): PlaylistRow? = stored?.takeIf { it.id == id }
}
