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

    data class EventOutcomeResult(
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
        val outcome = resolveEventOutcome(request.eventType, request.description ?: "", game, batter)
        return ScoringOutcome(
            outcome.eventType,
            outcome.description,
            outcome.outsAdded,
            outcome.basesMoved,
            outcome.isWalk,
            outcome.isHitByPitch,
        )
    }

    private fun resolveEventOutcome(
        initialEventType: ScoringEventType,
        initialDesc: String,
        game: GameEntity,
        batter: PlayerEntity,
    ): EventOutcomeResult {
        return when (initialEventType) {
            ScoringEventType.BALL -> resolveBallOutcome(game, batter, initialDesc)
            ScoringEventType.STRIKE -> resolveStrikeOutcome(game, batter, initialDesc)
            ScoringEventType.FOUL -> EventOutcomeResult(
                ScoringEventType.FOUL,
                handleFoul(game, batter, initialDesc),
                0, 0, false, false,
            )

            ScoringEventType.HIT_BY_PITCH -> EventOutcomeResult(
                ScoringEventType.HIT_BY_PITCH,
                "Hit by pitch",
                0, 0, false, true,
            )

            ScoringEventType.WALK -> EventOutcomeResult(ScoringEventType.WALK, initialDesc, 0, 0, true, false)
            else -> EventOutcomeResult(
                initialEventType,
                initialDesc,
                getOutsAdded(initialEventType),
                getBasesMoved(initialEventType),
                false,
                false,
            )
        }
    }

    private fun resolveBallOutcome(game: GameEntity, batter: PlayerEntity, desc: String): EventOutcomeResult {
        val result = handleBall(game, batter, desc)
        val type = if (result.second) ScoringEventType.WALK else ScoringEventType.BALL
        return EventOutcomeResult(type, result.first, 0, 0, result.second, false)
    }

    private fun resolveStrikeOutcome(game: GameEntity, batter: PlayerEntity, desc: String): EventOutcomeResult {
        val result = handleStrike(game, batter, desc)
        val outs = result.second
        val type = if (outs > 0) ScoringEventType.STRIKEOUT else ScoringEventType.STRIKE
        return EventOutcomeResult(type, result.first, outs, 0, false, false)
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
