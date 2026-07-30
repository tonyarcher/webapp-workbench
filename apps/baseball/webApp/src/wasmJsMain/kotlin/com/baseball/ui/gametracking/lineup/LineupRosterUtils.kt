package com.baseball.ui.gametracking.lineup

import com.baseball.api
import com.baseball.game.BaseballConstants
import com.baseball.game.TeamLineupConfig
import com.baseball.game.localAwayActivePitcherId
import com.baseball.game.localAwayActivePitcherName
import com.baseball.game.localAwayBench
import com.baseball.game.localAwayLineup
import com.baseball.game.localGame
import com.baseball.game.localHomeActivePitcherId
import com.baseball.game.localHomeActivePitcherName
import com.baseball.game.localHomeBench
import com.baseball.game.localHomeLineup
import com.baseball.game.saveLocalState
import com.baseball.game.startNewGame
import com.baseball.models.GameStatus
import com.baseball.models.Player
import com.baseball.ui.core.launch
import com.baseball.ui.state.AppViewManager
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.selectedGameId
import com.baseball.ui.state.selectedGameStatus

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

data class LineupCallbacks(
    val onDhToggle: (Boolean) -> Unit,
    val onLoadDefault: () -> Unit,
    val onRandom: () -> Unit,
    val onBack: () -> Unit,
    val onStartSave: () -> Unit,
)

data class CurrentLineupState(
    val homeTeam: com.baseball.models.Team,
    val awayTeam: com.baseball.models.Team,
    val useDh: Boolean,
    val awayLineupInputs: List<PlayerInputs>,
    val homeLineupInputs: List<PlayerInputs>,
    val awayPitcherName: String,
    val awayPitcherNumber: String,
    val homePitcherName: String,
    val homePitcherNumber: String,
)

internal fun createOnStartSave(
    state: CurrentLineupState,
    isSingleGameMode: Boolean,
    onError: (String) -> Unit,
    onSuccess: () -> Unit,
    onRender: () -> Unit,
): () -> Unit = {
    val awayInput = LineupValidationInput(
        state.homeTeam, state.awayTeam, state.useDh, isHome = false,
        state.awayLineupInputs, state.awayPitcherName, state.awayPitcherNumber
    )
    val homeInput = LineupValidationInput(
        state.homeTeam, state.awayTeam, state.useDh, isHome = true,
        state.homeLineupInputs, state.homePitcherName, state.homePitcherNumber
    )
    val awayRes = validateTeam(awayInput) { onError(it) }
    val homeRes = validateTeam(homeInput) { onError(it) }

    if (awayRes == null || homeRes == null) {
        onRender()
    } else {
        if (isSingleGameMode) {
            saveLocalGameLineup(homeRes, awayRes, state.homeTeam, state.awayTeam, state.useDh)
        } else {
            saveServerGameLineup(homeRes, awayRes)
        }
        onSuccess()
    }
}

internal fun populateWithRosters(
    homeRoster: List<Player>,
    awayRoster: List<Player>,
    config: PopulateRostersConfig,
) {
    if (homeRoster.isEmpty() && awayRoster.isEmpty()) return

    val (awayName, awayNum) = findPitcherInputs(awayRoster)
    config.setAwayP(awayName, awayNum)
    val (homeName, homeNum) = findPitcherInputs(homeRoster)
    config.setHomeP(homeName, homeNum)

    if (config.useDh) {
        applyRosterToLineup(
            config.awayLineupInputs, RosterApplyConfig(awayRoster, 9, awayName, awayNum)
        )
        applyRosterToLineup(
            config.homeLineupInputs, RosterApplyConfig(homeRoster, 9, homeName, homeNum)
        )
    } else {
        applyRosterToLineup(
            config.awayLineupInputs,
            RosterApplyConfig(awayRoster, 8, awayName, awayNum, usePitcherSlot = true)
        )
        applyRosterToLineup(
            config.homeLineupInputs,
            RosterApplyConfig(homeRoster, 8, homeName, homeNum, usePitcherSlot = true)
        )
    }
}

internal fun populateRostersWithRandom(
    useDh: Boolean,
    awayLineupInputs: MutableList<PlayerInputs>,
    homeLineupInputs: MutableList<PlayerInputs>,
    setAwayP: (String, String) -> Unit,
    setHomeP: (String, String) -> Unit,
) {
    val firstNames = listOf(
        "Babe", "Slider", "Fastball", "Windup", "HomeRun", "Bunt",
        "Knuckle", "Curve", "Spitball", "Slugger", "Rusty", "Ace", "Chippy", "Skip"
    )
    val lastNames = listOf(
        "Ruthless", "McGavin", "Freddie", "Willie", "Harry", "Master",
        "Jones", "Rodriguez", "O'Malley", "Swinger", "Slugson"
    )

    fun randomPlayer(pos: String): PlayerInputs {
        val name = "${firstNames.random()} ${lastNames.random()}"
        val num = kotlin.random.Random.nextInt(1, 100).toString()
        return PlayerInputs(name, num, pos)
    }

    val randomAwayP = randomPlayer("P")
    setAwayP(randomAwayP.name, randomAwayP.jerseyNumber)

    val randomHomeP = randomPlayer("P")
    setHomeP(randomHomeP.name, randomHomeP.jerseyNumber)

    val positions = listOf("C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH")
    val selectedAwayPositions = if (useDh) positions else positions.filter { it != "DH" } + "P"
    val selectedHomePositions = if (useDh) positions else positions.filter { it != "DH" } + "P"

    for (i in 0..8) {
        awayLineupInputs[i] = randomPlayer(selectedAwayPositions[i])
        homeLineupInputs[i] = randomPlayer(selectedHomePositions[i])
    }
}

internal fun saveLocalGameLineup(
    homeRes: Pair<List<Player>, List<Player>>,
    awayRes: Pair<List<Player>, List<Player>>,
    homeTeam: com.baseball.models.Team,
    awayTeam: com.baseball.models.Team,
    useDh: Boolean,
) {
    val awayActivePId = if (useDh) awayRes.second.first().id!! else awayRes.first.find { it.position == "P" }!!.id!!
    val homeActivePId = if (useDh) homeRes.second.first().id!! else homeRes.first.find { it.position == "P" }!!.id!!

    startNewGame(
        homeTeam = homeTeam,
        awayTeam = awayTeam,
        homeConfig = TeamLineupConfig(homeRes.first, homeRes.second, homeActivePId),
        awayConfig = TeamLineupConfig(awayRes.first, awayRes.second, awayActivePId),
        useDh = useDh,
    )

    localGame = localGame?.copy(status = GameStatus.IN_PROGRESS)
    saveLocalState()
    isLineupDialogOpen = false
    renderCurrentTab()
}

internal fun saveServerGameLineup(
    homeRes: Pair<List<Player>, List<Player>>,
    awayRes: Pair<List<Player>, List<Player>>,
) {
    launch {
        try {
            val activeGame = api.getGame(selectedGameId!!)
            val serverHomeLineup = createServerPlayers(activeGame.homeTeam.id, homeRes.first)
            val serverHomeBench = createServerPlayers(activeGame.homeTeam.id, homeRes.second)
            val serverAwayLineup = createServerPlayers(activeGame.awayTeam.id, awayRes.first)
            val serverAwayBench = createServerPlayers(activeGame.awayTeam.id, awayRes.second)

            api.startGame(activeGame.id!!)
            selectedGameStatus = GameStatus.IN_PROGRESS

            updateClientState(serverHomeLineup, serverHomeBench, serverAwayLineup, serverAwayBench)
            isLineupDialogOpen = false
            AppViewManager.renderApp()
            renderCurrentTab()
        } catch (expected: Throwable) {
            println("Error starting online game: ${expected.message}")
        }
    }
}

internal suspend fun createServerPlayers(teamId: Long?, players: List<Player>): List<Player> =
    players.map { p ->
        api.createPlayer(
            Player(
                id = null,
                teamId = teamId,
                name = p.name,
                position = p.position,
                jerseyNumber = p.jerseyNumber,
                battingHand = "R",
                throwingHand = "R",
            ),
        )
    }

internal fun updateClientState(
    homeLineup: List<Player>,
    homeBench: List<Player>,
    awayLineup: List<Player>,
    awayBench: List<Player>,
) {
    localHomeLineup.clear()
    localHomeLineup.addAll(homeLineup)
    localHomeBench.clear()
    localHomeBench.addAll(homeBench)
    localAwayLineup.clear()
    localAwayLineup.addAll(awayLineup)
    localAwayBench.clear()
    localAwayBench.addAll(awayBench)

    val homeP = homeBench.find { it.position == "P" } ?: homeLineup.find { it.position == "P" }
    val awayP = awayBench.find { it.position == "P" } ?: awayLineup.find { it.position == "P" }
    localHomeActivePitcherId = homeP?.id ?: 110L
    localHomeActivePitcherName = homeP?.name ?: "Pitcher"
    localAwayActivePitcherId = awayP?.id ?: 210L
    localAwayActivePitcherName = awayP?.name ?: "Pitcher"
}

internal fun validateTeam(
    input: LineupValidationInput,
    onError: (String) -> Unit,
): Pair<List<Player>, List<Player>>? {
    val error = getTeamValidationError(
        TeamValidationRequest(
            input.homeTeam, input.awayTeam, input.useDh, input.isHome,
            input.lineupInputs, input.pitcherName, input.pitcherNumber
        )
    )
    if (error != null) { onError(error); return null }

    val teamName = if (input.isHome) input.homeTeam.name else input.awayTeam.name
    val baseId = if (input.isHome) 1000L else 2000L
    val teamId = if (input.isHome) input.homeTeam.id else input.awayTeam.id
    val lineupPlayers = buildLineupPlayers(input.lineupInputs, baseId, teamId)
    val config = BenchBuildConfig(
        input.useDh, input.pitcherName, input.pitcherNumber, lineupPlayers,
        input.lineupInputs, baseId, teamId, teamName
    )
    val (benchPlayers, _) = buildBenchAndPitcher(config)
    return Pair(lineupPlayers, benchPlayers)
}
