package com.baseball.ui.gametracking.lineup

import com.baseball.api
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
    if (error != null) {
        onError(error); return null
    }

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
