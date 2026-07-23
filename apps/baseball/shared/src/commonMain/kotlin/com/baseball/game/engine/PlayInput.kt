package com.baseball.game.engine

import kotlinx.serialization.Serializable
import com.baseball.models.ScoringEventType

@Serializable
data class PlayInput(
    val eventType: ScoringEventType,
    val batterId: Long,
    val pitcherId: Long,
    val descriptionDetail: String? = null,
    val isDoublePlay: Boolean = false,
    val isError: Boolean = false,
    val runnerAdvanceMap: Map<String, Int>? = null,
    val nextEventId: Long = 1L
)
