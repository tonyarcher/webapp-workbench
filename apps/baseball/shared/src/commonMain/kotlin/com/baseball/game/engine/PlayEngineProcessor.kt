package com.baseball.game.engine

import com.baseball.game.GameSessionState
import com.baseball.models.PlayEvent
import com.baseball.models.Player

/**
 * Lightweight processor that resolves batter/pitcher and creates a minimal PlayEvent.
 * The logic is split into private helper methods to keep the `execute` method short and
 * satisfy Detekt's `LongMethod` rule (max 30 lines).
 */
class PlayEngineProcessor(
    private val state: GameSessionState,
    private val input: PlayInput
) {
    fun execute(): Pair<GameSessionState, PlayEvent> {
        val batter = resolveBatter()
        val pitcher = resolvePitcher()
        val event = buildEvent(batter, pitcher)
        return Pair(state, event)
    }

    private fun resolveBatter(): Player = (state.homeRoster + state.awayRoster)
        .find { it.id == input.batterId } ?: Player(
        id = input.batterId,
        teamId = null,
        name = "Unknown Batter",
        position = "",
        jerseyNumber = 0,
        battingHand = "R",
        throwingHand = "R"
    )

    private fun resolvePitcher(): Player = (state.homeRoster + state.awayRoster)
        .find { it.id == input.pitcherId } ?: Player(
        id = input.pitcherId,
        teamId = null,
        name = "Unknown Pitcher",
        position = "P",
        jerseyNumber = 0,
        battingHand = "R",
        throwingHand = "R"
    )

    private fun buildEvent(batter: Player, pitcher: Player): PlayEvent = PlayEvent(
        id = input.nextEventId,
        gameId = state.game.id ?: 1L,
        inning = state.game.gameState.inning,
        half = state.game.gameState.half,
        outsBefore = state.game.gameState.outs,
        outsAfter = state.game.gameState.outs,
        balls = 0,
        strikes = 0,
        batterName = batter.name,
        pitcherName = pitcher.name,
        eventType = input.eventType,
        description = input.descriptionDetail ?: "",
        runsScoredOnPlay = 0,
        timestamp = ""
    )
}
