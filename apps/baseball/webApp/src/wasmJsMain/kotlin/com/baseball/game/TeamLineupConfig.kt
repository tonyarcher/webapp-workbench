package com.baseball.game

import com.baseball.models.Player

data class TeamLineupConfig(
    val lineup: List<Player>,
    val bench: List<Player>,
    val activePitcherId: Long,
)
