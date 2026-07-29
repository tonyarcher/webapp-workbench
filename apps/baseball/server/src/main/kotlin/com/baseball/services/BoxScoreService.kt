package com.baseball.services

import com.baseball.repositories.GameInningRepository
import com.baseball.repositories.GameRepository
import com.baseball.repositories.PlayerGameBattingStatsRepository
import com.baseball.repositories.PlayerGamePitchingStatsRepository
import com.baseball.repositories.PlayerRepository
import com.baseball.repositories.TeamRepository
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
) {

    @Transactional(readOnly = true)
    fun getBoxScore(gameId: Long): com.baseball.models.BoxScore {
        val game = gameRepository.findById(gameId)
            .orElseThrow { IllegalArgumentException("Game not found: $gameId") }
        val homeTeam = teamRepository.findById(game.homeTeamId)
            .orElseThrow { IllegalArgumentException("Home Team not found: ${game.homeTeamId}") }.toDomain()
        val awayTeam = teamRepository.findById(game.awayTeamId)
            .orElseThrow { IllegalArgumentException("Away Team not found: ${game.awayTeamId}") }.toDomain()

        val lineScore = createLineScore(
            LineScoreParams(
                gameId = gameId,
                gameInningRepository = gameInningRepository,
                awayScore = game.awayScore,
                homeScore = game.homeScore,
                awayHits = game.awayHits,
                homeHits = game.homeHits,
                awayErrors = game.awayErrors,
                homeErrors = game.homeErrors,
            )
        )
        return buildBoxScoreResponse(gameId, homeTeam.name, awayTeam.name, lineScore, game.homeTeamId)
    }

    private fun buildBoxScoreResponse(
        gameId: Long,
        homeName: String,
        awayName: String,
        lineScore: com.baseball.models.LineScore,
        homeTeamId: Long,
    ): com.baseball.models.BoxScore {
        val (homeBatting, awayBatting) = getBattingStats(gameId, battingRepository, playerRepository, homeTeamId)
        val (homePitching, awayPitching) = getPitchingStats(gameId, pitchingRepository, playerRepository, homeTeamId)
        return com.baseball.models.BoxScore(
            gameId = gameId,
            homeTeamName = homeName,
            awayTeamName = awayName,
            lineScore = lineScore,
            homeBatting = homeBatting,
            awayBatting = awayBatting,
            homePitching = homePitching,
            awayPitching = awayPitching,
        )
    }
}
