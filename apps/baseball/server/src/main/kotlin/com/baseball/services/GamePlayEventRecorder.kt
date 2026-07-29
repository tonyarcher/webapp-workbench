package com.baseball.services

import com.baseball.entities.GameEntity
import com.baseball.entities.PlayEventEntity
import com.baseball.entities.PlayerEntity
import com.baseball.entities.PlayerGameBattingStatsEntity
import com.baseball.entities.PlayerGamePitchingStatsEntity
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.HalfInning
import com.baseball.models.ScoringEventRequest
import com.baseball.models.ScoringEventType
import java.time.Instant

class GamePlayEventRecorder(
    private val repos: EventRecorderRepositories,
    private val scoringLogicService: ScoringLogicService,
    private val serviceMapGameToDomain: (GameEntity) -> Game,
) {
    data class PlayContext(
        val game: GameEntity,
        val request: ScoringEventRequest,
        val batter: PlayerEntity,
        val pitcher: PlayerEntity,
        val batterStats: PlayerGameBattingStatsEntity,
        val pitcherStats: PlayerGamePitchingStatsEntity,
        val outcome: ScoringLogicService.ScoringOutcome,
        val outsBefore: Int,
        val runsScoredList: MutableList<Long> = mutableListOf(),
    )

    private val statsRecorder = GamePlayStatsRecorder(repos)
    private val statsUpdater = PlayEventStatsUpdater(statsRecorder, repos)
    private val runnerAdvancer = PlayEventRunnerAdvancer

    fun record(gameId: Long, request: ScoringEventRequest): Game {
        val ctx = initGameContext(gameId, request)
        if (isResolved(ctx.outcome.eventType)) {
            processResolvedPlay(ctx)
        }
        applyRuns(ctx)
        savePlayEventLog(ctx)
        val saved = repos.gameRepository.save(ctx.game)
        return serviceMapGameToDomain(saved)
    }

    private fun initGameContext(gameId: Long, request: ScoringEventRequest): PlayContext {
        val game = repos.gameRepository.findById(gameId)
            .orElseThrow { IllegalArgumentException("Game not found: $gameId") }
        check(game.status != GameStatus.COMPLETED) { "Cannot record events for a completed game" }
        if (game.status == GameStatus.SCHEDULED) {
            game.status = GameStatus.IN_PROGRESS
        }
        val batter = repos.playerRepository.findById(request.batterId)
            .orElseThrow { IllegalArgumentException("Batter not found: ${request.batterId}") }
        val pitcher = repos.playerRepository.findById(request.pitcherId)
            .orElseThrow { IllegalArgumentException("Pitcher not found: ${request.pitcherId}") }

        game.currentBatterId = batter.id
        game.currentPitcherId = pitcher.id

        val batterStats = statsRecorder.getOrCreateBattingStats(gameId, batter.id!!)
        val pitcherStats = statsRecorder.getOrCreatePitchingStats(gameId, pitcher.id!!)
        val outcome = scoringLogicService.handleScoringEvent(request, batter, game)

        return PlayContext(
            game = game, request = request, batter = batter, pitcher = pitcher,
            batterStats = batterStats, pitcherStats = pitcherStats,
            outcome = outcome, outsBefore = game.outs,
        )
    }

    private fun isResolved(eventType: ScoringEventType): Boolean =
        eventType in listOf(
            ScoringEventType.SINGLE, ScoringEventType.DOUBLE, ScoringEventType.TRIPLE,
            ScoringEventType.HOME_RUN, ScoringEventType.WALK, ScoringEventType.HIT_BY_PITCH,
            ScoringEventType.STRIKEOUT, ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT,
            ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT, ScoringEventType.ERROR,
            ScoringEventType.FIELDER_CHOICE, ScoringEventType.SACRIFICE_FLY,
        )

    private fun processResolvedPlay(ctx: PlayContext) {
        val outsAdded = if (ctx.request.isDoublePlay) maxOf(ctx.outcome.outsAdded, 2) else ctx.outcome.outsAdded
        statsUpdater.handleErrorFielding(ctx.game, ctx.request)

        ctx.game.balls = 0
        ctx.game.strikes = 0

        statsUpdater.updateStats(ctx.outcome.eventType, ctx.game, ctx.batterStats, ctx.pitcherStats)
        statsUpdater.updateFielding(ctx.outcome.eventType, ctx.game)

        if (outsAdded > 0) {
            val actualOutsAdded = minOf(outsAdded, 3 - ctx.outsBefore)
            if (actualOutsAdded > 0) ctx.pitcherStats.inningsPitchedThirds += actualOutsAdded
        }

        runnerAdvancer.advanceRunners(ctx, outsAdded)

        if (ctx.outcome.eventType == ScoringEventType.SACRIFICE_FLY) {
            ctx.game.runnerThirdId?.let {
                ctx.runsScoredList.add(it)
                ctx.game.runnerThirdId = null
            }
        }

        ctx.game.outs += outsAdded
        if (ctx.game.outs >= 3) advanceInning(ctx.game)
    }

    private fun advanceInning(game: GameEntity) {
        checkGameCompletion(game)
        game.runnerFirstId = null
        game.runnerSecondId = null
        game.runnerThirdId = null
        game.outs = 0
        statsRecorder.getOrCreateInningRuns(game.id!!, game.inning)
        if (game.half == HalfInning.TOP) {
            game.half = HalfInning.BOTTOM
        } else {
            game.half = HalfInning.TOP
            game.inning += 1
        }
    }

    private fun applyRuns(ctx: PlayContext) {
        ctx.runsScoredList.forEach { runnerId ->
            ctx.batterStats.rbi += 1
            if (runnerId != ctx.batter.id) {
                val rStats = statsRecorder.getOrCreateBattingStats(ctx.game.id!!, runnerId)
                rStats.runs += 1
                repos.battingRepository?.save(rStats)
            }
            ctx.pitcherStats.runsAllowed += 1
            ctx.pitcherStats.earnedRuns += 1
            val currentInningRuns = statsRecorder.getOrCreateInningRuns(ctx.game.id!!, ctx.game.inning)
            if (ctx.game.half == HalfInning.TOP) {
                ctx.game.awayScore += 1
                currentInningRuns.awayRuns = (currentInningRuns.awayRuns ?: 0) + 1
            } else {
                ctx.game.homeScore += 1
                currentInningRuns.homeRuns = (currentInningRuns.homeRuns ?: 0) + 1
            }
            repos.gameInningRepository.save(currentInningRuns)
        }

        if (ctx.runsScoredList.isNotEmpty()) checkGameCompletion(ctx.game)
        repos.battingRepository?.save(ctx.batterStats)
        repos.pitchingRepository?.save(ctx.pitcherStats)
    }

    private fun savePlayEventLog(ctx: PlayContext) {
        val playEvent = PlayEventEntity(
            gameId = ctx.game.id!!,
            batterName = ctx.batter.name,
            pitcherName = ctx.pitcher.name,
            eventType = ctx.outcome.eventType,
            description = ctx.outcome.description,
        ).apply {
            this.inning = ctx.game.inning
            this.half = ctx.game.half
            this.outsBefore = ctx.outsBefore
            this.outsAfter = ctx.game.outs
            this.balls = ctx.game.balls
            this.strikes = ctx.game.strikes
            this.runsScoredOnPlay = ctx.runsScoredList.size
            this.timestamp = Instant.now().toString()
        }
        repos.playEventRepository?.save(playEvent)
    }

    private fun checkGameCompletion(game: GameEntity) {
        if (game.inning >= com.baseball.ServerConstants.MIN_COMPLETION_INNING) {
            val isTopComplete = game.half == HalfInning.TOP && game.outs >= 3
            val isBottomComplete = game.half == HalfInning.BOTTOM && game.outs >= 3
            if (isTopComplete && game.homeScore > game.awayScore) {
                game.status = GameStatus.COMPLETED
            } else if (game.half == HalfInning.BOTTOM && game.homeScore > game.awayScore) {
                game.status = GameStatus.COMPLETED
            } else if (isBottomComplete && game.awayScore != game.homeScore) {
                game.status = GameStatus.COMPLETED
            }
        }
    }
}
