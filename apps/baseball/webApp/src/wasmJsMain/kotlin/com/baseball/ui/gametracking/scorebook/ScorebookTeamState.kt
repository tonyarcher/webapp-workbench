package com.baseball.ui.gametracking.scorebook

import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.PlayEvent
import com.baseball.models.Player
import com.baseball.models.PlayerBattingStats

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

data class ScorecardRenderParams(
    val slotPlayers: Array<MutableList<String>>,
    val battingStatsList: List<PlayerBattingStats>,
    val teamEvents: List<PlayEvent>,
    val maxInning: Int,
    val parser: ScorecardParser,
    val isHomeBatting: Boolean,
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
