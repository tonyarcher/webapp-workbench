package com.baseball.ui.gametracking.lineup

data class PlayerInputs(
    val name: String,
    val jerseyNumber: String,
    val position: String,
)

data class LineupUiContext(
    val useDh: Boolean,
    val awayTeamName: String,
    val homeTeamName: String,
    val awayLineupInputs: MutableList<PlayerInputs>,
    val homeLineupInputs: MutableList<PlayerInputs>,
    val awayPitcherName: String,
    val awayPitcherNumber: String,
    val homePitcherName: String,
    val homePitcherNumber: String,
)

