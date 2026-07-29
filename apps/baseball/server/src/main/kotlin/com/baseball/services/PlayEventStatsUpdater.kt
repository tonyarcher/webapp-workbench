package com.baseball.services

import com.baseball.entities.GameEntity
import com.baseball.entities.PlayerGameBattingStatsEntity
import com.baseball.entities.PlayerGamePitchingStatsEntity
import com.baseball.models.HalfInning
import com.baseball.models.ScoringEventRequest
import com.baseball.models.ScoringEventType

class PlayEventStatsUpdater(
    private val statsRecorder: GamePlayStatsRecorder,
    private val repos: EventRecorderRepositories,
) {
    fun updateStats(
        eventType: ScoringEventType,
        game: GameEntity,
        bStats: PlayerGameBattingStatsEntity,
        pStats: PlayerGamePitchingStatsEntity,
    ) {
        when (eventType) {
            ScoringEventType.SINGLE, ScoringEventType.DOUBLE,
            ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN -> applyExtraHitStats(eventType, bStats, pStats, game)
            ScoringEventType.WALK -> { bStats.walks += 1; pStats.walksAllowed += 1 }
            ScoringEventType.HIT_BY_PITCH -> bStats.hitByPitch += 1
            ScoringEventType.STRIKEOUT -> { bStats.strikeOuts += 1; bStats.atBats += 1; pStats.strikeoutsRecorded += 1 }
            ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT,
            ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT,
            ScoringEventType.FIELDER_CHOICE -> bStats.atBats += 1
            ScoringEventType.ERROR -> { bStats.atBats += 1; incrementTeamErrors(game) }
            else -> {}
        }
    }

    private fun applyExtraHitStats(
        eventType: ScoringEventType,
        bStats: PlayerGameBattingStatsEntity,
        pStats: PlayerGamePitchingStatsEntity,
        game: GameEntity,
    ) {
        applyHitStats(bStats, pStats, game)
        when (eventType) {
            ScoringEventType.DOUBLE -> bStats.doubles += 1
            ScoringEventType.TRIPLE -> bStats.triples += 1
            ScoringEventType.HOME_RUN -> { bStats.homeRuns += 1; bStats.runs += 1; pStats.homeRunsAllowed += 1 }
            else -> {}
        }
    }

    private fun applyHitStats(
        bStats: PlayerGameBattingStatsEntity,
        pStats: PlayerGamePitchingStatsEntity,
        game: GameEntity,
    ) {
        bStats.hits += 1
        bStats.atBats += 1
        pStats.hitsAllowed += 1
        incrementTeamHits(game)
    }

    fun updateFielding(eventType: ScoringEventType, game: GameEntity) {
        when (eventType) {
            ScoringEventType.STRIKEOUT -> recordOutFielder(game, "C")
            ScoringEventType.GROUNDOUT -> {
                recordOutFielder(game, "1B")
                getFielderId(game, game.half, listOf("SS", "2B", "3B").random())?.let {
                    statsRecorder.incrementFieldingStats(game.id!!, it, assists = 1)
                }
            }
            ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT,
            ScoringEventType.POP_OUT, ScoringEventType.SACRIFICE_FLY -> {
                recordOutFielder(game, listOf("LF", "CF", "RF", "SS", "2B", "3B", "1B").random())
            }
            ScoringEventType.ERROR -> {
                val defenders = listOf("LF", "CF", "RF", "SS", "2B", "3B", "1B", "P", "C")
                getFielderId(game, game.half, defenders.random())?.let {
                    statsRecorder.incrementFieldingStats(game.id!!, it, errors = 1)
                }
            }
            else -> {}
        }
    }

    fun handleErrorFielding(game: GameEntity, request: ScoringEventRequest) {
        if (request.isError && request.eventType != ScoringEventType.ERROR) {
            incrementTeamErrors(game)
            val defenders = listOf("LF", "CF", "RF", "SS", "2B", "3B", "1B", "P", "C")
            getFielderId(game, game.half, defenders.random())?.let {
                statsRecorder.incrementFieldingStats(game.id!!, it, errors = 1)
            }
        }
    }

    private fun recordOutFielder(game: GameEntity, pos: String) {
        getFielderId(game, game.half, pos)?.let {
            statsRecorder.incrementFieldingStats(game.id!!, it, putouts = 1)
        }
    }

    private fun incrementTeamHits(game: GameEntity) {
        if (game.half == HalfInning.TOP) game.awayHits += 1 else game.homeHits += 1
    }

    private fun incrementTeamErrors(game: GameEntity) {
        if (game.half == HalfInning.TOP) game.homeErrors += 1 else game.awayErrors += 1
    }

    private fun getFielderId(game: GameEntity, half: HalfInning, position: String): Long? {
        val defendingTeamId = if (half == HalfInning.TOP) game.homeTeamId else game.awayTeamId
        val defenders = repos.playerRepository.findAllByTeamId(defendingTeamId)
        return defenders.find { it.position == position }?.id ?: defenders.firstOrNull()?.id
    }
}
