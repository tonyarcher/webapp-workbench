package com.baseball.game

import com.baseball.models.ScoringEventType
import kotlinx.serialization.Serializable

@Serializable
data class PlayEventInput(
    val eventType: ScoringEventType,
    val batterId: Long,
    val pitcherId: Long,
    val descriptionDetail: String? = null,
    val isDoublePlay: Boolean = false,
    val isError: Boolean = false,
    val runnerAdvanceMap: Map<String, Int>? = null,
)
