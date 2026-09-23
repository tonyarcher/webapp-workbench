package radioapi.persist

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant
import java.util.UUID

interface StationRepo : JpaRepository<StationEntity, String> {
    fun findAllByOrderByNameAsc(): List<StationEntity>
}

interface TrackRepo : JpaRepository<TrackEntity, UUID> {
    fun findAllByOrderByRotationAscRankAsc(): List<TrackEntity>
}

interface PlaylistRepo : JpaRepository<PlaylistEntity, UUID> {
    @Query(
        value = """
            SELECT CAST(id AS varchar) FROM playlists
            WHERE station_id = :stationId AND seed = :seed
              AND starts_at = :startsAt AND weights = CAST(:weights AS jsonb)
        """,
        nativeQuery = true,
    )
    fun findSameId(
        @Param("stationId") stationId: String,
        @Param("seed") seed: String,
        @Param("startsAt") startsAt: Instant,
        @Param("weights") weights: String,
    ): String?
}

interface PlaylistEntryRepo : JpaRepository<PlaylistEntryEntity, PlaylistEntryKey> {
    fun findAllByIdPlaylistIdOrderByIdIdxAsc(playlistId: UUID): List<PlaylistEntryEntity>
}
