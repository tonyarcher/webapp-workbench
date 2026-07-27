package com.baseball.services

import com.baseball.models.PlayerBattingStats
import com.baseball.models.PlayerPitchingStats
import com.baseball.repositories.PlayerGameBattingStatsRepository
import com.baseball.repositories.PlayerGamePitchingStatsRepository
import com.baseball.repositories.PlayerRepository

fun getBattingStats(
    gameId: Long,
    battingRepository: PlayerGameBattingStatsRepository,
    playerRepository: PlayerRepository,
    homeTeamId: Long
): Pair<MutableList<PlayerBattingStats>, MutableList<PlayerBattingStats>> {
    val battingStats = battingRepository.findAllByGameId(gameId)
    val homeBatting = mutableListOf<PlayerBattingStats>()
    val awayBatting = mutableListOf<PlayerBattingStats>()

    battingStats.forEach { stat ->
        val player = playerRepository.findById(stat.playerId).orElseThrow()
        val domainStat = stat.toDomain(player.name, player.jerseyNumber, player.position)
        if (player.teamId == homeTeamId) homeBatting.add(domainStat) else awayBatting.add(domainStat)
    }
    return Pair(homeBatting, awayBatting)
}

fun getPitchingStats(
    gameId: Long,
    pitchingRepository: PlayerGamePitchingStatsRepository,
    playerRepository: PlayerRepository,
    homeTeamId: Long
): Pair<MutableList<PlayerPitchingStats>, MutableList<PlayerPitchingStats>> {
    val pitchingStats = pitchingRepository.findAllByGameId(gameId)
    val homePitching = mutableListOf<PlayerPitchingStats>()
    val awayPitching = mutableListOf<PlayerPitchingStats>()

    pitchingStats.forEach { stat ->
        val player = playerRepository.findById(stat.playerId).orElseThrow()
        val domainStat = stat.toDomain(player.name, player.jerseyNumber, player.position)
        if (player.teamId == homeTeamId) homePitching.add(domainStat) else awayPitching.add(domainStat)
    }
    return Pair(homePitching, awayPitching)
}
