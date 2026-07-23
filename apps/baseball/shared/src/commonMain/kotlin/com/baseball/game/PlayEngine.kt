package com.baseball.game

import com.baseball.game.engine.PlayEngineProcessor
import com.baseball.game.engine.PlayInput
import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.PlayEvent
import com.baseball.models.Player
import com.baseball.models.ScoringEventType

// Domain models used by the engine

data class GameSessionState(
    val game: Game,
    val boxScore: BoxScore,
    val homeRoster: List<Player>,
    val awayRoster: List<Player>,
    val homeLineup: List<Player>,
    val awayLineup: List<Player>,
    val homeBench: List<Player>,
    val awayBench: List<Player>,
    val homeBatterIndex: Int,
    val awayBatterIndex: Int,
    val playersSubbedOut: List<Long>,
    val homeActivePitcherId: Long,
    val homeActivePitcherName: String,
    val awayActivePitcherId: Long,
    val awayActivePitcherName: String,
)

data class EventData(
    val resolvedType: ScoringEventType,
    val outsAdded: Int,
    val basesMoved: Int,
    val isWalk: Boolean,
    val isHbp: Boolean,
    val description: String,
)

data class AdvanceData(
    val homeIdx: Int,
    val awayIdx: Int,
    val nextBatter: Player,
    val nextPitcherId: Long,
    val nextPitcherName: String,
)

object PlayEngine {
    // Primary API using PlayInput – all game logic is delegated to PlayEngineProcessor
    fun processPlay(state: GameSessionState, input: PlayInput): Pair<GameSessionState, PlayEvent> {
        return PlayEngineProcessor(state, input).execute()
    }
}
