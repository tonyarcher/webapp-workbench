package com.baseball.services

import com.baseball.ServerConstants
import com.baseball.entities.*
import com.baseball.models.*
import com.baseball.repositories.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class BoxScoreService(
    private val gameRepository: GameRepository,
    private val teamRepository: TeamRepository,
    private val playerRepository: PlayerRepository,
    private val gameInningRepository: GameInningRepository,
    private val battingRepository: PlayerGameBattingStatsRepository,
    private val pitchingRepository: PlayerGamePitchingStatsRepository,
    private val fieldingRepository: PlayerGameFieldingStatsRepository,
) {

    @Transactional(readOnly = true)
    fun getBoxScore(gameId: Long): BoxScore {
        val game = gameRepository.findById(gameId).orElseThrow { IllegalArgumentException("Game not found: $gameId") }
        val homeTeam = teamRepository.findById(game.homeTeamId).orElseThrow { IllegalArgumentException("Home Team not found: ${game.homeTeamId}") }.toDomain()
        val awayTeam = teamRepository.findById(game.awayTeamId).orElseThrow { IllegalArgumentException("Away Team not found: ${game.awayTeamId}") }.toDomain()

        val innings = gameInningRepository.findAllByGameIdOrderByInningAsc(gameId)
        val maxInnings = maxOf(ServerConstants.MIN_COMPLETION_INNING, innings.maxOfOrNull { it.inning } ?: ServerConstants.MIN_COMPLETION_INNING)
        val awayInningRuns = mutableListOf<Int?>()
        val homeInningRuns = mutableListOf<Int?>()
        for (i in 1..maxInnings) {
            val inn = innings.find { it.inning == i }
            awayInningRuns.add(inn?.awayRuns)
            homeInningRuns.add(inn?.homeRuns)
        }
        val lineScore = LineScore(
            gameId = gameId,
            awayInningRuns = awayInningRuns,
            homeInningRuns = homeInningRuns,
            awayRuns = game.awayScore,
            homeRuns = game.homeScore,
            awayHits = game.awayHits,
            homeHits = game.homeHits,
            awayErrors = game.awayErrors,
            homeErrors = game.homeErrors,
        )

        val battingStats = battingRepository.findAllByGameId(gameId)
        val pitchingStats = pitchingRepository.findAllByGameId(gameId)
        val homeBatting = mutableListOf<PlayerBattingStats>()
        val awayBatting = mutableListOf<PlayerBattingStats>()
        val homePitching = mutableListOf<PlayerPitchingStats>()
        val awayPitching = mutableListOf<PlayerPitchingStats>()

        battingStats.forEach { stat ->
            val player = playerRepository.findById(stat.playerId).orElseThrow()
            val domainStat = stat.toDomain(player.name, player.jerseyNumber, player.position)
            if (player.teamId == game.homeTeamId) homeBatting.add(domainStat) else awayBatting.add(domainStat)
        }
        pitchingStats.forEach { stat ->
            val player = playerRepository.findById(stat.playerId).orElseThrow()
            val domainStat = stat.toDomain(player.name, player.jerseyNumber, player.position)
            if (player.teamId == game.homeTeamId) homePitching.add(domainStat) else awayPitching.add(domainStat)
        }
        return BoxScore(
            gameId = gameId,
            homeTeamName = homeTeam.name,
            awayTeamName = awayTeam.name,
            lineScore = lineScore,
            homeBatting = homeBatting,
            awayBatting = awayBatting,
            homePitching = homePitching,
            awayPitching = awayPitching,
        )
    }


}
