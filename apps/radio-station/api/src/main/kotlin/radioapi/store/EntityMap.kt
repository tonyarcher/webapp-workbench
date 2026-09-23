package radioapi.store

import radioapi.domain.Track
import radioapi.domain.WEEK_MS
import radioapi.domain.Weights
import radioapi.domain.canonicalizeWeights
import radioapi.domain.weightsJson
import radioapi.persist.PlaylistEntity
import radioapi.persist.PlaylistEntryEntity
import radioapi.persist.PlaylistEntryKey
import radioapi.persist.TrackEntity
import radioapi.service.EntryRow
import radioapi.service.PlaylistRow
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import java.util.UUID

fun TrackEntity.toTrack(): Track = Track(
    id = id.toString(),
    artist = artist,
    title = title,
    durationMs = durationMs,
    year = year ?: 0,
    genre = genre,
    era = era,
    rotation = rotation,
    rank = rank,
    explicit = explicit,
    radioEdit = radioEdit,
)

fun PlaylistEntity.toRow(stationName: String): PlaylistRow = PlaylistRow(
    id = getId(),
    stationId = stationId,
    stationName = stationName,
    seed = seed,
    startsAt = startsAt.toEpochMilli(),
    durationMs = durationMs,
    weights = readWeights(weights),
    createdAt = createdAt.toEpochMilli(),
)

fun PlaylistEntryEntity.toRow(track: TrackEntity?): EntryRow = EntryRow(
    idx = getId().idx,
    trackId = trackId.toString(),
    artist = track?.artist ?: "",
    title = track?.title ?: "",
    startsAt = startsAt.toEpochMilli(),
    durationMs = durationMs,
    rotation = track?.rotation ?: "",
    era = track?.era ?: "",
)

fun newPlaylist(stationId: String, seed: String, startsAtMs: Long, weights: Weights): PlaylistEntity {
    val entity = PlaylistEntity()
    entity.setId(UUID.randomUUID())
    entity.stationId = stationId
    entity.seed = seed
    entity.startsAt = Instant.ofEpochMilli(startsAtMs)
    entity.durationMs = WEEK_MS
    entity.weights = weightsJson(weights)
    entity.createdAt = Instant.now()
    return entity
}

fun newEntry(playlistId: UUID, row: EntryRow): PlaylistEntryEntity {
    val entity = PlaylistEntryEntity()
    val key = PlaylistEntryKey()
    key.playlistId = playlistId
    key.idx = row.idx
    entity.setId(key)
    entity.trackId = UUID.fromString(row.trackId)
    entity.startsAt = Instant.ofEpochMilli(row.startsAt)
    entity.durationMs = row.durationMs
    return entity
}

private fun readWeights(raw: String): Weights {
    val node = JsonMapper().readTree(raw)
    val values = mutableMapOf<String, Any?>()
    node.propertyNames().forEach { name -> values[name] = node.path(name).asInt() }
    return canonicalizeWeights(values)
}
