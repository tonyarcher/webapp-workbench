package com.baseball.services

import com.baseball.models.PlayerBattingStats
import com.baseball.models.PlayerFieldingStats
import com.baseball.models.PlayerPitchingStats
import com.baseball.models.SeasonStats
import com.baseball.repositories.GameRepository
import com.baseball.repositories.PlayerGameBattingStatsRepository
import com.baseball.repositories.PlayerGameFieldingStatsRepository
import com.baseball.repositories.PlayerGamePitchingStatsRepository
import com.baseball.repositories.PlayerRepository
import com.baseball.repositories.SeasonRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class SeasonStatsService(
    private val seasonRepository: SeasonRepository,
    private val gameRepository: GameRepository,
    private val playerRepository: PlayerRepository,
    private val battingRepository: PlayerGameBattingStatsRepository,
    private val pitchingRepository: PlayerGamePitchingStatsRepository,
    private val fieldingRepository: PlayerGameFieldingStatsRepository,
) {
    @Transactional(readOnly = true)
    fun getSeasonStats(seasonId: Long): SeasonStats {
        seasonRepository.findById(seasonId)
            .orElseThrow {
                IllegalArgumentException("Season not found: $seasonId")
            }
        val games = gameRepository.findAllBySeasonId(seasonId)
        val gameIds = games.map { it.id!! }

        if (gameIds.isEmpty()) {
            return SeasonStats(
                seasonId = seasonId,
                battingStats = emptyList(),
                pitchingStats = emptyList(),
                fieldingStats = emptyList(),
            )
        }

        val allPlayers = playerRepository.findAll().associateBy { it.id!! }
        val aggregatedBatting = aggregateBattingStats(gameIds, allPlayers)
        val aggregatedPitching = aggregatePitchingStats(gameIds, allPlayers)
        val aggregatedFielding = aggregateFieldingStats(gameIds, allPlayers)

        return SeasonStats(
            seasonId = seasonId,
            battingStats = aggregatedBatting,
            pitchingStats = aggregatedPitching,
            fieldingStats = aggregatedFielding,
        )
    }

    private fun aggregateBattingStats(
        gameIds: List<Long>,
        allPlayers: Map<Long, com.baseball.entities.PlayerEntity>,
    ): List<PlayerBattingStats> {
        val battingEntities = battingRepository.findAllByGameIdIn(gameIds)
        return battingEntities
            .groupBy { it.playerId }
            .map { entry ->
                val playerId = entry.key
                val statsList = entry.value
                val p = allPlayers[playerId]
                PlayerBattingStats(
                    playerId = playerId,
                    playerName = p?.name ?: "Unknown",
                    jerseyNumber = p?.jerseyNumber ?: 0,
                    position = p?.position ?: "DH",
                    atBats = statsList.sumOf { it.atBats },
                    runs = statsList.sumOf { it.runs },
                    hits = statsList.sumOf { it.hits },
                    rbi = statsList.sumOf { it.rbi },
                    doubles = statsList.sumOf { it.doubles },
                    triples = statsList.sumOf { it.triples },
                    homeRuns = statsList.sumOf { it.homeRuns },
                    walks = statsList.sumOf { it.walks },
                    strikeOuts = statsList.sumOf { it.strikeOuts },
                    hitByPitch = statsList.sumOf { it.hitByPitch },
                )
            }.sortedByDescending { it.hits }
    }

    private fun aggregatePitchingStats(
        gameIds: List<Long>,
        allPlayers: Map<Long, com.baseball.entities.PlayerEntity>,
    ): List<PlayerPitchingStats> {
        val pitchingEntities = pitchingRepository.findAllByGameIdIn(gameIds)
        return pitchingEntities
            .groupBy { it.playerId }
            .map { entry ->
                val playerId = entry.key
                val statsList = entry.value
                val p = allPlayers[playerId]
                PlayerPitchingStats(
                    playerId = playerId,
                    playerName = p?.name ?: "Unknown",
                    jerseyNumber = p?.jerseyNumber ?: 0,
                    position = p?.position ?: "P",
                    inningsPitchedThirds = statsList.sumOf { it.inningsPitchedThirds },
                    hitsAllowed = statsList.sumOf { it.hitsAllowed },
                    runsAllowed = statsList.sumOf { it.runsAllowed },
                    earnedRuns = statsList.sumOf { it.earnedRuns },
                    walksAllowed = statsList.sumOf { it.walksAllowed },
                    strikeoutsRecorded = statsList.sumOf { it.strikeoutsRecorded },
                    homeRunsAllowed = statsList.sumOf { it.homeRunsAllowed },
                )
            }.sortedByDescending { it.strikeoutsRecorded }
    }

    private fun aggregateFieldingStats(
        gameIds: List<Long>,
        allPlayers: Map<Long, com.baseball.entities.PlayerEntity>,
    ): List<PlayerFieldingStats> {
        val fieldingEntities = fieldingRepository.findAllByGameIdIn(gameIds)
        return fieldingEntities
            .groupBy { it.playerId }
            .map { entry ->
                val playerId = entry.key
                val statsList = entry.value
                val p = allPlayers[playerId]
                val po = statsList.sumOf { it.putouts }
                val a = statsList.sumOf { it.assists }
                val e = statsList.sumOf { it.errors }
                val totalChances = po + a + e
                val fpct = if (totalChances > 0) (po + a).toDouble() / totalChances else 1.0
                PlayerFieldingStats(
                    playerId = playerId,
                    playerName = p?.name ?: "Unknown",
                    jerseyNumber = p?.jerseyNumber ?: 0,
                    position = p?.position ?: "DH",
                    putouts = po,
                    assists = a,
                    errors = e,
                    fieldingPercentage = Math.round(fpct * 1000.0) / 1000.0,
                )
            }.sortedByDescending { it.errors }
    }
}
