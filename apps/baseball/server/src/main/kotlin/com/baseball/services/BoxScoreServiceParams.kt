package com.baseball.services

import com.baseball.repositories.GameInningRepository
import com.baseball.repositories.GameRepository
import com.baseball.repositories.PlayerGameBattingStatsRepository
import com.baseball.repositories.PlayerGameFieldingStatsRepository
import com.baseball.repositories.PlayerGamePitchingStatsRepository
import com.baseball.repositories.PlayerRepository
import com.baseball.repositories.TeamRepository

data class BoxScoreServiceParams(
    val gameRepository: GameRepository,
    val teamRepository: TeamRepository,
    val playerRepository: PlayerRepository,
    val gameInningRepository: GameInningRepository,
    val battingRepository: PlayerGameBattingStatsRepository,
    val pitchingRepository: PlayerGamePitchingStatsRepository,
    val fieldingRepository: PlayerGameFieldingStatsRepository
)
