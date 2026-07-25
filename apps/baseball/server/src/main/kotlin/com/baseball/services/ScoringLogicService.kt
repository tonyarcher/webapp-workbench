package com.baseball.services

import com.baseball.ScoringConstants
import com.baseball.entities.GameEntity
import com.baseball.entities.PlayerEntity
import com.baseball.models.ScoringEventRequest
import com.baseball.models.ScoringEventType
import org.springframework.stereotype.Service

@Service
class ScoringLogicService {
    data class ScoringOutcome(
        val eventType: ScoringEventType,
        val description: String,
        val outsAdded: Int,
        val basesMoved: Int,
        val isWalk: Boolean,
        val isHitByPitch: Boolean,
    )

    fun handleScoringEvent(
        request: ScoringEventRequest,
        batter: PlayerEntity,
        _unusedPitcher: PlayerEntity,
        game: GameEntity,
    ): ScoringOutcome {
        var eventType = request.eventType
        var description = request.description ?: ""
        var outsAdded = 0
        var basesMoved = 0
        var isWalk = false
        var isHitByPitch = false
        when (eventType) {
            ScoringEventType.BALL -> {
                game.balls += 1
                description = if (description.isEmpty()) "Ball to ${batter.name}" else description
                if (game.balls >= ScoringConstants.BALLS_FOR_WALK) {
                    game.balls = 0
                    isWalk = true
                    eventType = ScoringEventType.WALK
                }
            }
            ScoringEventType.STRIKE -> {
                game.strikes += 1
                description = if (description.isEmpty()) "Strike to ${batter.name}" else description
                if (game.strikes >= ScoringConstants.STRIKES_FOR_STRIKEOUT) {
                    outsAdded = 1
                    game.strikes = 0
                    game.balls = 0
                    eventType = ScoringEventType.STRIKEOUT
                }
            }
            ScoringEventType.FOUL -> {
                if (game.strikes < 2) {
                    game.strikes += 1
                }
                description = if (description.isEmpty()) "Foul by ${batter.name}" else description
            }
            ScoringEventType.HIT_BY_PITCH -> {
                isHitByPitch = true
                description = "Hit by pitch"
            }
            ScoringEventType.WALK -> {
                // Walk already handled in BALL case when count reaches limit
                isWalk = true
            }
            else -> {}
        }
        return ScoringOutcome(eventType, description, outsAdded, basesMoved, isWalk, isHitByPitch)
    }
}
