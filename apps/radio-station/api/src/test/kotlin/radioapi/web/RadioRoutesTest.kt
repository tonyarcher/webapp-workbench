package radioapi.web

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.http.HttpStatus
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import radioapi.domain.DEFAULT_WEIGHTS
import radioapi.service.EntryRow
import radioapi.service.GeneratedWeek
import radioapi.service.PlaylistRow
import radioapi.service.PlaylistWriter
import radioapi.service.StationRow
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@WebMvcTest(StationController::class, PlaylistController::class, HealthController::class)
@Import(FakeWriterConfig::class)
class RadioRoutesTest {
    @Autowired
    lateinit var mvc: MockMvc

    @Test
    fun healthAndStations() {
        assertEquals(200, mvc.get("/healthz").andReturn().response.status)
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE.value(), mvc.get("/readyz").andReturn().response.status)
        val stations = mvc.get("/stations") { header("X-Api-Version", "1") }.andReturn()
        assertEquals(200, stations.response.status)
        assertTrue(stations.response.contentAsString.contains("Pulse 101"))
    }

    @Test
    fun missingVersionIs404() {
        assertEquals(HttpStatus.NOT_FOUND.value(), mvc.get("/stations").andReturn().response.status)
    }

    @Test
    fun createAndTxt() {
        val created = mvc.post("/playlists") {
            header("X-Api-Version", "1")
            contentType = org.springframework.http.MediaType.APPLICATION_JSON
            content = """{"stationId":"top40","seed":"autumn-oak"}"""
        }.andReturn()
        assertEquals(200, created.response.status)
        val txt = mvc.get("/playlists/$PLAYLIST/txt") {
            header("X-Api-Version", "1")
            param("tz", "UTC")
        }.andReturn()
        assertEquals(200, txt.response.status)
        assertTrue(txt.response.contentAsString.contains("Pulse 101"))
    }

    @Test
    fun missingPlaylistIs404() {
        val missing = mvc.get("/playlists/00000000-0000-4000-8000-000000000001") {
            header("X-Api-Version", "1")
        }.andReturn()
        assertEquals(HttpStatus.NOT_FOUND.value(), missing.response.status)
        val entries = mvc.get("/playlists/00000000-0000-4000-8000-000000000001/entries") {
            header("X-Api-Version", "1")
        }.andReturn()
        assertEquals(HttpStatus.NOT_FOUND.value(), entries.response.status)
        val txt = mvc.get("/playlists/$PLAYLIST/txt") { header("X-Api-Version", "1") }.andReturn()
        assertEquals(200, txt.response.status)
        val created = mvc.post("/playlists") {
            header("X-Api-Version", "1")
            contentType = org.springframework.http.MediaType.APPLICATION_JSON
            content = "{}"
        }.andReturn()
        assertEquals(200, created.response.status)
    }

    @Test
    fun badIdAndZone() {
        val bad = mvc.get("/playlists/nope") { header("X-Api-Version", "1") }.andReturn()
        assertEquals(HttpStatus.BAD_REQUEST.value(), bad.response.status)
        val zone = mvc.get("/playlists/$PLAYLIST/txt") {
            header("X-Api-Version", "1")
            param("tz", "Not/AZone")
        }.andReturn()
        assertEquals(HttpStatus.BAD_REQUEST.value(), zone.response.status)
    }
}

private const val PLAYLIST = "00000000-0000-4000-8000-000000000099"

@Configuration
class FakeWriterConfig {
    @Bean
    fun playlistWriter(): PlaylistWriter = PlaylistWriter(FakeHttpRecords())
}

private class FakeHttpRecords : radioapi.service.PlaylistRecords {
    private val playlist = PlaylistRow(
        UUID.fromString(PLAYLIST),
        "top40",
        "Pulse 101",
        "autumn-oak",
        0L,
        1L,
        DEFAULT_WEIGHTS,
        0L,
    )

    override fun stations(): List<StationRow> = listOf(StationRow("top40", "Pulse 101", "Top 40"))

    override fun tracks() = emptyList<radioapi.domain.Track>()

    override fun find(stationId: String, seed: String, startsAtMs: Long, weightsJson: String) = playlist

    override fun insert(
        stationId: String,
        seed: String,
        startsAtMs: Long,
        weights: radioapi.domain.Weights,
        entries: List<EntryRow>,
    ) = playlist

    override fun entries(id: UUID) = listOf(EntryRow(0, "t", "A", "Song", 0L, 180_000, "power", "current"))

    override fun findById(id: UUID) = playlist.takeIf { it.id == id }
}
