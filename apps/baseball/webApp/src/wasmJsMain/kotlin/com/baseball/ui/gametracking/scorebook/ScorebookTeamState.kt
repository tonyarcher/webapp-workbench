package com.baseball.ui.gametracking.scorebook

import com.baseball.models.PlayEvent
import com.baseball.models.PlayerBattingStats

data class ScorecardRenderParams(
    val playersByBattingSlot: Array<MutableList<String>>,
    val battingStatsList: List<PlayerBattingStats>,
    val teamEvents: List<PlayEvent>,
    val maxInning: Int,
    val parser: ScorecardParser,
    val isHomeBatting: Boolean,
)

data class RowRenderData(
    val substitutePlayerName: String,
    val cellBackground: String,
)

