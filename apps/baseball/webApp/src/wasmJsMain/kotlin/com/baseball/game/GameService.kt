package com.baseball.game

import com.baseball.models.*

interface GameService {
    fun initGame(forceReset: Boolean = false)
    fun recordPlayEvent(
        eventType: ScoringEventType,
        batterId: Long,
        pitcherId: Long,
        descriptionDetail: String? = null,
        isDoublePlay: Boolean = false,
        isError: Boolean = false,
        runnerAdvanceMap: Map<String, Int>? = null
    )
}
