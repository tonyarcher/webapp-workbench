package com.baseball.ui.gametracking.lineup

import com.baseball.game.BaseballConstants
import com.baseball.models.Player

data class PlayerInputs(
    val name: String,
    val jerseyNumber: String,
    val position: String,
)

data class BenchBuildConfig(
    val useDh: Boolean,
    val pitcherName: String,
    val pitcherNumber: String,
    val lineupPlayers: List<Player>,
    val lineupInputs: List<PlayerInputs>,
    val baseId: Long,
    val teamId: Long?,
    val teamName: String,
)

data class RosterApplyConfig(
    val roster: List<Player>,
    val maxBatters: Int,
    val pitcherName: String,
    val pitcherNumber: String,
    val usePitcherSlot: Boolean = false,
)

data class LineupAdjustConfig(
    val useDh: Boolean,
    val awayLineupInputs: MutableList<PlayerInputs>,
    val homeLineupInputs: MutableList<PlayerInputs>,
    val awayPitcherName: String,
    val awayPitcherNumber: String,
    val homePitcherName: String,
    val homePitcherNumber: String,
)

data class LineupUiContext(
    val useDh: Boolean,
    val awayTeamName: String,
    val homeTeamName: String,
    val awayLineupInputs: MutableList<PlayerInputs>,
    val homeLineupInputs: MutableList<PlayerInputs>,
    val awayPitcherName: String,
    val awayPitcherNumber: String,
    val homePitcherName: String,
    val homePitcherNumber: String,
)

data class LineupPitcherChangeHandlers(
    val onAwayPitcherNameChange: (String) -> Unit,
    val onAwayPitcherNumberChange: (String) -> Unit,
    val onHomePitcherNameChange: (String) -> Unit,
    val onHomePitcherNumberChange: (String) -> Unit,
)

data class LineupValidationInput(
    val homeTeam: com.baseball.models.Team,
    val awayTeam: com.baseball.models.Team,
    val useDh: Boolean,
    val isHome: Boolean,
    val lineupInputs: List<PlayerInputs>,
    val pitcherName: String,
    val pitcherNumber: String,
)

data class PopulateRostersConfig(
    val useDh: Boolean,
    val awayLineupInputs: MutableList<PlayerInputs>,
    val homeLineupInputs: MutableList<PlayerInputs>,
    val setAwayP: (String, String) -> Unit,
    val setHomeP: (String, String) -> Unit,
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
            teamId = config.teamId,
            name = config.pitcherName.trim(),
            position = "P",
            jerseyNumber = config.pitcherNumber.toInt(),
            battingHand = "R",
            throwingHand = "R",
        )
        benchPlayers.add(pPlayer)
        activePitcherId = pPlayer.id!!
    } else {
        val pitcherLineupIndex = config.lineupInputs.indexOfFirst { it.position == "P" }
        activePitcherId = config.lineupPlayers[pitcherLineupIndex].id!!
    }

    benchPlayers.addAll(buildDefaultBench(config.baseId, config.teamId, config.teamName))

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
        lineup[config.maxBatters] = PlayerInputs(config.pitcherName, config.pitcherNumber, "P")
    }
}

internal fun findPitcherInputs(roster: List<Player>): Pair<String, String> {
    val p = roster.find { it.position == BaseballConstants.Positions.P }
    return Pair(p?.name ?: "", p?.jerseyNumber?.toString() ?: "")
}

internal fun adjustLineupPositions(config: LineupAdjustConfig) {
    if (config.useDh) {
        adjustPositionsForDh(config.awayLineupInputs, config.homeLineupInputs)
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
    if (config.awayLineupInputs[0].position == "DH") {
        config.awayLineupInputs[0] = config.awayLineupInputs[0].copy(position = "LF")
    }
    config.awayLineupInputs[8] = PlayerInputs(config.awayPitcherName, config.awayPitcherNumber, "P")
    if (config.homeLineupInputs[0].position == "DH") {
        config.homeLineupInputs[0] = config.homeLineupInputs[0].copy(position = "LF")
    }
    config.homeLineupInputs[8] = PlayerInputs(config.homePitcherName, config.homePitcherNumber, "P")
}
