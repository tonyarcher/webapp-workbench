package com.baseball.ui.tabs.scorer

import com.baseball.BaseballConstants
import com.baseball.game.localAwayActivePitcherId
import com.baseball.game.localAwayActivePitcherName
import com.baseball.game.localAwayBatterIndex
import com.baseball.game.localAwayBench
import com.baseball.game.localAwayLineup
import com.baseball.game.localHomeActivePitcherId
import com.baseball.game.localHomeActivePitcherName
import com.baseball.game.localHomeBatterIndex
import com.baseball.game.localHomeBench
import com.baseball.game.localHomeLineup
import com.baseball.models.Game
import com.baseball.models.Player

internal object ScorerLineupHarmonizer {
    fun harmonizeAwayLineup(game: Game, awayRoster: List<Player>) {
        harmonizeTeamLineup(game, awayRoster, AwayLineupStateAccess())
    }

    fun harmonizeHomeLineup(game: Game, homeRoster: List<Player>) {
        harmonizeTeamLineup(game, homeRoster, HomeLineupStateAccess())
    }
}

internal interface LineupStateAccess {
    val lineup: MutableList<Player>
    val bench: MutableList<Player>
    var batterIndex: Int
    var activePitcherId: Long
    var activePitcherName: String
    val defaultPitcherId: Long
    val defaultPitcherName: String
}

private class AwayLineupStateAccess : LineupStateAccess {
    override val lineup: MutableList<Player> get() = localAwayLineup
    override val bench: MutableList<Player> get() = localAwayBench
    override var batterIndex: Int
        get() = localAwayBatterIndex
        set(value) { localAwayBatterIndex = value }
    override var activePitcherId: Long
        get() = localAwayActivePitcherId
        set(value) { localAwayActivePitcherId = value }
    override var activePitcherName: String
        get() = localAwayActivePitcherName
        set(value) { localAwayActivePitcherName = value }
    override val defaultPitcherId: Long = 210L
    override val defaultPitcherName: String = "Sonny Gray"
}

private class HomeLineupStateAccess : LineupStateAccess {
    override val lineup: MutableList<Player> get() = localHomeLineup
    override val bench: MutableList<Player> get() = localHomeBench
    override var batterIndex: Int
        get() = localHomeBatterIndex
        set(value) { localHomeBatterIndex = value }
    override var activePitcherId: Long
        get() = localHomeActivePitcherId
        set(value) { localHomeActivePitcherId = value }
    override var activePitcherName: String
        get() = localHomeActivePitcherName
        set(value) { localHomeActivePitcherName = value }
    override val defaultPitcherId: Long = 110L
    override val defaultPitcherName: String = "Justin Steele"
}

internal fun harmonizeTeamLineup(game: Game, roster: List<Player>, state: LineupStateAccess) {
    if (state.lineup.isEmpty()) {
        state.lineup.addAll(roster.filter { it.position != BaseballConstants.Positions.P }.take(9))
        state.bench.addAll(
            roster.filter {
                it.position == BaseballConstants.Positions.P &&
                        it.id != game.gameState.currentPitcherId
            } + roster.drop(10)
        )
        state.activePitcherId = game.gameState.currentPitcherId
            ?: roster.find { it.position == BaseballConstants.Positions.P }?.id ?: state.defaultPitcherId
        state.activePitcherName = game.gameState.currentPitcherName
            ?: roster.find { it.position == BaseballConstants.Positions.P }?.name ?: state.defaultPitcherName
        state.batterIndex = state.lineup.indexOfFirst { it.id == game.gameState.currentBatterId }
            .coerceAtLeast(0)
    } else {
        state.lineup.removeAll { p -> roster.none { it.id == p.id } }
        state.bench.removeAll { p -> roster.none { it.id == p.id } }
        val newPlayers = roster.filter { r ->
            state.lineup.none { it.id == r.id } && state.bench.none { it.id == r.id }
        }
        state.bench.addAll(newPlayers)
        while (state.lineup.size < 9 && state.bench.isNotEmpty()) {
            state.lineup.add(state.bench.removeFirst())
        }
    }
}


