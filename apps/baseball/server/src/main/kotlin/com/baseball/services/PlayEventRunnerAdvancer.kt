package com.baseball.services

import com.baseball.entities.GameEntity
import com.baseball.models.ScoringEventType

object PlayEventRunnerAdvancer {
    fun advanceRunners(ctx: GamePlayEventRecorder.PlayContext, outsAdded: Int) {
        val advanceMap = ctx.request.runnerAdvanceMap
        if (advanceMap != null && advanceMap.isNotEmpty()) {
            advanceRunWithMap(ctx, advanceMap, outsAdded)
        } else {
            if (ctx.request.isDoublePlay) removeDoublePlayRunner(ctx.game)
            if (ctx.outcome.basesMoved > 0 || ctx.outcome.isWalk || ctx.outcome.isHitByPitch) {
                advanceRunDefault(ctx)
            }
        }
    }

    private fun advanceRunWithMap(
        ctx: GamePlayEventRecorder.PlayContext,
        advanceMap: Map<String, Int>,
        outsAdded: Int,
    ) {
        val game = ctx.game
        game.runnerFirstId = null
        game.runnerSecondId = null
        game.runnerThirdId = null

        var currentOutsAdded = outsAdded
        advanceMap.forEach { (pIdStr, targetBase) ->
            val pId = pIdStr.toLongOrNull() ?: return@forEach
            when (targetBase) {
                1 -> game.runnerFirstId = pId
                2 -> game.runnerSecondId = pId
                3 -> game.runnerThirdId = pId
                4 -> ctx.runsScoredList.add(pId)
                0 -> if (pId != ctx.batter.id) currentOutsAdded = maxOf(currentOutsAdded, 1)
            }
        }
        if (!advanceMap.containsKey(ctx.batter.id.toString())) {
            val bMoved = ctx.outcome.basesMoved
            if (bMoved in 1..3) {
                setRunnerByBase(game, bMoved, ctx.batter.id)
            } else if (bMoved == 4) {
                ctx.runsScoredList.add(ctx.batter.id!!)
            } else if (currentOutsAdded == 0 && isReachBase(ctx.outcome)) {
                game.runnerFirstId = ctx.batter.id
            }
        }
    }

    private fun setRunnerByBase(game: GameEntity, base: Int, playerId: Long?) {
        when (base) {
            1 -> game.runnerFirstId = playerId
            2 -> game.runnerSecondId = playerId
            3 -> game.runnerThirdId = playerId
        }
    }

    private fun isReachBase(outcome: ScoringLogicService.ScoringOutcome): Boolean =
        outcome.isWalk || outcome.isHitByPitch ||
            outcome.eventType == ScoringEventType.ERROR ||
            outcome.eventType == ScoringEventType.FIELDER_CHOICE

    private fun removeDoublePlayRunner(game: GameEntity) {
        when {
            game.runnerThirdId != null -> game.runnerThirdId = null
            game.runnerSecondId != null -> game.runnerSecondId = null
            game.runnerFirstId != null -> game.runnerFirstId = null
        }
    }

    private fun advanceRunDefault(ctx: GamePlayEventRecorder.PlayContext) {
        val state = RunnerState(
            game = ctx.game, batter = ctx.batter,
            r1 = ctx.game.runnerFirstId, r2 = ctx.game.runnerSecondId, r3 = ctx.game.runnerThirdId,
            runsScoredList = ctx.runsScoredList,
        )
        if (ctx.outcome.isWalk || ctx.outcome.isHitByPitch) {
            RunnerAdvancementHelper.advanceRunnersOnWalk(state)
        } else {
            RunnerAdvancementHelper.advanceRunnersOnHit(ctx.outcome.basesMoved, state)
        }
    }
}
