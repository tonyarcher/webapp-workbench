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
                val result = handleBall(game, batter, description)
                description = result.first
                if (result.second) {
                    isWalk = true
                    eventType = ScoringEventType.WALK
                }
            }
            ScoringEventType.STRIKE -> {
                val result = handleStrike(game, batter, description)
                description = result.first
                if (result.second > 0) {
                    outsAdded = result.second
                    eventType = ScoringEventType.STRIKEOUT
                }
            }
            ScoringEventType.FOUL -> {
                description = handleFoul(game, batter, description)
            }
            ScoringEventType.HIT_BY_PITCH -> {
                isHitByPitch = true
                description = "Hit by pitch"
            }
            ScoringEventType.WALK -> {
                isWalk = true
            }
            else -> {
                basesMoved = getBasesMoved(eventType)
                outsAdded = getOutsAdded(eventType)
            }
        }
        return ScoringOutcome(eventType, description, outsAdded, basesMoved, isWalk, isHitByPitch)
    }

    private fun handleBall(game: GameEntity, batter: PlayerEntity, currentDesc: String): Pair<String, Boolean> {
        game.balls += 1
        val desc = if (currentDesc.isEmpty()) "Ball to ${batter.name}" else currentDesc
        if (game.balls >= ScoringConstants.BALLS_FOR_WALK) {
            game.balls = 0
            return Pair(desc, true)
        }
        return Pair(desc, false)
    }

    private fun handleStrike(game: GameEntity, batter: PlayerEntity, currentDesc: String): Pair<String, Int> {
        game.strikes += 1
        val desc = if (currentDesc.isEmpty()) "Strike to ${batter.name}" else currentDesc
        if (game.strikes >= ScoringConstants.STRIKES_FOR_STRIKEOUT) {
            game.strikes = 0
            game.balls = 0
            return Pair(desc, 1)
        }
        return Pair(desc, 0)
    }

    private fun handleFoul(game: GameEntity, batter: PlayerEntity, currentDesc: String): String {
        if (game.strikes < 2) {
            game.strikes += 1
        }
        return if (currentDesc.isEmpty()) "Foul by ${batter.name}" else currentDesc
    }

    private fun getBasesMoved(type: ScoringEventType): Int = when (type) {
        ScoringEventType.SINGLE -> 1
        ScoringEventType.DOUBLE -> 2
        ScoringEventType.TRIPLE -> 3
        ScoringEventType.HOME_RUN -> 4
        else -> 0
    }

    private fun getOutsAdded(type: ScoringEventType): Int = when (type) {
        ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT,
        ScoringEventType.POP_OUT, ScoringEventType.STRIKEOUT -> 1
        else -> 0
    }
}
