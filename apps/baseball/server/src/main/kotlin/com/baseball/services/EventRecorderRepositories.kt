package com.baseball.services

import com.baseball.entities.GameEntity
import com.baseball.entities.PlayerEntity
import com.baseball.repositories.GameInningRepository
import com.baseball.repositories.GameRepository
import com.baseball.repositories.PlayEventRepository
import com.baseball.repositories.PlayerGameBattingStatsRepository
import com.baseball.repositories.PlayerGameFieldingStatsRepository
import com.baseball.repositories.PlayerGamePitchingStatsRepository
import com.baseball.repositories.PlayerRepository
import com.baseball.repositories.TeamRepository

data class EventRecorderRepositories(
    val gameRepository: GameRepository,
    val gameInningRepository: GameInningRepository,
    val playerRepository: PlayerRepository,
    val teamRepository: TeamRepository?,
    val playEventRepository: PlayEventRepository?,
    val battingRepository: PlayerGameBattingStatsRepository?,
    val pitchingRepository: PlayerGamePitchingStatsRepository?,
    val fieldingRepository: PlayerGameFieldingStatsRepository?,
)

data class RunnerState(
    val game: GameEntity,
    val batter: PlayerEntity,
    val r1: Long?,
    val r2: Long?,
    val r3: Long?,
    val runsScoredList: MutableList<Long>,
)
