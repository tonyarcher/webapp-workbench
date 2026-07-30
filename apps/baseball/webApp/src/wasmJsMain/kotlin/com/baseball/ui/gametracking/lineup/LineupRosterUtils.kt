package com.baseball.ui.gametracking.lineup

import com.baseball.models.Player
import com.baseball.game.BaseballConstants

data class PlayerInputs(
    val name: String,
    val jerseyNumber: String,
    val position: String,
)

data class BenchBuildConfig(
    val useDh: Boolean,
    val pName: String,
    val pNum: String,
    val lineupPlayers: List<Player>,
    val list: List<PlayerInputs>,
    val baseId: Long,
    val tId: Long?,
    val teamName: String,
)

data class RosterApplyConfig(
    val roster: List<Player>,
    val maxBatters: Int,
    val pitcherName: String,
    val pitcherNum: String,
    val usePitcherSlot: Boolean = false,
)

data class LineupAdjustConfig(
    val useDh: Boolean,
    val awayLineup: MutableList<PlayerInputs>,
    val homeLineup: MutableList<PlayerInputs>,
    val awayPName: String,
    val awayPNum: String,
    val homePName: String,
    val homePNum: String,
)

data class LineupUiContext(
    val useDh: Boolean,
    val awayTeamName: String,
    val homeTeamName: String,
    val awayLineup: MutableList<PlayerInputs>,
    val homeLineup: MutableList<PlayerInputs>,
    val awayPName: String,
    val awayPNum: String,
    val homePName: String,
    val homePNum: String,
)

internal fun buildLineupPlayers(
    list: List<PlayerInputs>,
    baseId: Long,
    tId: Long?,
): List<Player> =
    list.mapIndexed { idx, item ->
        Player(
            id = baseId + idx + 1,
            teamId = tId,
            name = item.name.trim(),
            position = item.position,
            jerseyNumber = item.jerseyNumber.toInt(),
            battingHand = "R",
            throwingHand = "R",
        )
    }

internal fun buildBenchAndPitcher(config: BenchBuildConfig): Pair<List<Player>, Long> {
    val benchPlayers = mutableListOf<Player>()
    var activePitcherId = config.baseId + 10L

    if (config.useDh) {
        val pPlayer = Player(
            id = config.baseId + 10L,
            teamId = config.tId,
            name = config.pName.trim(),
            position = "P",
            jerseyNumber = config.pNum.toInt(),
            battingHand = "R",
            throwingHand = "R",
        )
        benchPlayers.add(pPlayer)
        activePitcherId = pPlayer.id!!
    } else {
        val pitcherLineupIndex = config.list.indexOfFirst { it.position == "P" }
        activePitcherId = config.lineupPlayers[pitcherLineupIndex].id!!
    }

    benchPlayers.addAll(buildDefaultBench(config.baseId, config.tId, config.teamName))

    return Pair(benchPlayers, activePitcherId)
}

internal fun buildDefaultBench(baseId: Long, tId: Long?, teamName: String): List<Player> =
    (1..4).map { idx ->
        Player(
            id = baseId + 10L + idx,
            teamId = tId,
            name = "Sub $idx ($teamName)",
            position = if (idx == 1) "P" else "OF",
            jerseyNumber = (80 + idx) % 100,
            battingHand = "R",
            throwingHand = "R",
        )
    }

internal fun applyRosterToLineup(lineup: MutableList<PlayerInputs>, config: RosterApplyConfig) {
    val batters = config.roster.filter { it.position != BaseballConstants.Positions.P }.take(config.maxBatters)
    batters.forEachIndexed { i, p ->
        lineup[i] = PlayerInputs(p.name, p.jerseyNumber.toString(), p.position)
    }
    if (config.usePitcherSlot) {
        lineup[config.maxBatters] = PlayerInputs(config.pitcherName, config.pitcherNum, "P")
    }
}

internal fun findPitcherInputs(roster: List<Player>): Pair<String, String> {
    val p = roster.find { it.position == BaseballConstants.Positions.P }
    return Pair(p?.name ?: "", p?.jerseyNumber?.toString() ?: "")
}

internal fun adjustLineupPositions(config: LineupAdjustConfig) {
    if (config.useDh) {
        adjustPositionsForDh(config.awayLineup, config.homeLineup)
    } else {
        adjustPositionsNoDh(config)
    }
}

internal fun adjustPositionsForDh(away: MutableList<PlayerInputs>, home: MutableList<PlayerInputs>) {
    if (away[8].position == "P") {
        away[8] = away[8].copy(position = "RF")
    }
    if (away[0].position != "DH") {
        away[0] = away[0].copy(position = "DH")
    }
    if (home[8].position == "P") {
        home[8] = home[8].copy(position = "RF")
    }
    if (home[0].position != "DH") {
        home[0] = home[0].copy(position = "DH")
    }
}

internal fun adjustPositionsNoDh(config: LineupAdjustConfig) {
    if (config.awayLineup[0].position == "DH") {
        config.awayLineup[0] = config.awayLineup[0].copy(position = "LF")
    }
    config.awayLineup[8] = PlayerInputs(config.awayPName, config.awayPNum, "P")
    if (config.homeLineup[0].position == "DH") {
        config.homeLineup[0] = config.homeLineup[0].copy(position = "LF")
    }
    config.homeLineup[8] = PlayerInputs(config.homePName, config.homePNum, "P")
}
