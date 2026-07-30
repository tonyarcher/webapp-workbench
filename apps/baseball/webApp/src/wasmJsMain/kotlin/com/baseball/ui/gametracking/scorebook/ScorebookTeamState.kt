package com.baseball.ui.gametracking.scorebook

import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.Player

data class ScorebookTeamState(
    val awayRoster: List<Player>,
    val homeRoster: List<Player>,
    val awayActivePitcherId: Long,
    val homeActivePitcherId: Long,
    val awayActivePitcherName: String,
    val homeActivePitcherName: String,
)

data class ScorebookSectionData(
    val game: Game,
    val boxScore: BoxScore,
    val maxInning: Int,
)

data class LineScoreData(
    val teamAbb: String,
    val inningRuns: List<Int?>,
    val currentInning: Int,
    val r: Int,
    val h: Int,
    val e: Int,
    val maxInning: Int,
)
