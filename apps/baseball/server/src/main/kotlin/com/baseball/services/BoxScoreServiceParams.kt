package com.baseball.services

import com.baseball.repositories.*

data class BoxScoreServiceParams(
    val gameRepository: GameRepository,
    val teamRepository: TeamRepository,
    val playerRepository: PlayerRepository,
    val gameInningRepository: GameInningRepository,
    val battingRepository: PlayerGameBattingStatsRepository,
    val pitchingRepository: PlayerGamePitchingStatsRepository,
    val fieldingRepository: PlayerGameFieldingStatsRepository
)
