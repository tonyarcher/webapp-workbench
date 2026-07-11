package com.baseball.game

import com.baseball.models.*

interface GameService {
    fun initLocalGame(forceReset: Boolean = false)
    fun recordLocalPlayEvent(
        eventType: ScoringEventType,
        batterId: Long,
        pitcherId: Long,
        descriptionDetail: String? = null,
        isDoublePlay: Boolean = false,
        isError: Boolean = false,
        runnerAdvanceMap: Map<String, Int>? = null
    )
}
