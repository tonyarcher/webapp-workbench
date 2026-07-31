package com.baseball.ui.tabs.scorer

import com.baseball.api
import com.baseball.game.initGame
import com.baseball.game.localAwayRoster
import com.baseball.game.localBoxScore
import com.baseball.game.localEvents
import com.baseball.game.localGame
import com.baseball.game.localHomeRoster
import com.baseball.game.undoLastLocalEvent
import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.PlayEvent
import com.baseball.models.Player
import com.baseball.ui.core.launch
import com.baseball.ui.gametracking.lineup.LineupSetupOverlay
import com.baseball.ui.gametracking.lineup.isLineupDialogOpen
import com.baseball.ui.gametracking.scoring.renderGameScoringControls
import com.baseball.ui.gametracking.scoring.renderScorerLedScoreboard
import com.baseball.ui.state.isSingleGameMode
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.selectedGameId
import com.baseball.ui.state.selectedGameStatus
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h1
import kotlinx.html.h2
import kotlinx.html.id
import kotlinx.html.js.onClickFunction
import kotlinx.html.p
import org.w3c.dom.HTMLElement
import org.w3c.dom.events.Event

var isResetDialogOpen = false

internal fun renderLiveScorerTab(container: HTMLElement) {
    com.baseball.game.onOpenLineupSetupDialog = {
        isLineupDialogOpen = true
        renderCurrentTab()
    }
    if (!isSingleGameMode && selectedGameId == null) {
        renderNoGameSelectedCard(container)
        return
    }
    launch {
        try {
            if (isSingleGameMode && localGame == null) initGame(forceReset = false)
            val data = loadScorerData()
            container.innerHTML = ""
            if (data.game.status == GameStatus.SCHEDULED) {
                renderStartGameCard(container, data.game)
                return@launch
            }
            renderLiveScorerMainView(container, data)
        } catch (e: IllegalStateException) {
            renderScorerErrorCard(container, e.message)
        }
    }
}

private fun renderNoGameSelectedCard(container: HTMLElement) {
    container.append {
        div(classes = "card text-center padding-lg") {
            p { +"No game selected. Go to Season Dashboard to select one." }
        }
    }
}

internal data class ScorerData(
    val game: Game,
    val events: List<PlayEvent>,
    val boxScore: BoxScore,
    val homeRoster: List<Player>,
    val awayRoster: List<Player>,
)

private suspend fun loadScorerData(): ScorerData {
    if (isSingleGameMode) {
        return ScorerData(localGame!!, localEvents, localBoxScore!!, localHomeRoster, localAwayRoster)
    }
    val gId = selectedGameId!!
    val game = api.getGame(gId)
    val events = api.getGameEvents(gId)
    val boxScore = api.getGameBoxScore(gId)
    val homeRoster = api.getTeamRoster(game.homeTeam.id!!)
    val awayRoster = api.getTeamRoster(game.awayTeam.id!!)
    selectedGameStatus = game.status
    ScorerLineupHarmonizer.harmonizeAwayLineup(game, awayRoster)
    ScorerLineupHarmonizer.harmonizeHomeLineup(game, homeRoster)
    return ScorerData(game, events, boxScore, homeRoster, awayRoster)
}

private fun renderLiveScorerMainView(container: HTMLElement, data: ScorerData) {
    renderScorerHeader(container, data.game)
    container.append {
        div(classes = "scorekeeper-grid") {
            div(classes = "scoreboard-led") {}
            div(classes = "card") { id = "scoring-controls-card" }
        }
    }
    val topGrid = container.querySelector(".scorekeeper-grid") as HTMLElement
    val scoreboardLed = topGrid.querySelector(".scoreboard-led") as HTMLElement
    val scoringControlsCard = topGrid.querySelector("#scoring-controls-card") as HTMLElement
    renderScorerLedScoreboard(scoreboardLed, data.game)
    renderGameScoringControls(scoringControlsCard, data.game, data.homeRoster, data.awayRoster)
    renderPlayMonitoringSection(container, data)
    if (isLineupDialogOpen) {
        LineupSetupOverlay(container, data.homeRoster, data.awayRoster, data.game.homeTeam, data.game.awayTeam).render()
    }
    if (isResetDialogOpen) renderResetGameOverlay(container)
}

private fun renderScorerHeader(container: HTMLElement, game: Game) {
    container.append {
        div(classes = "flex-between margin-bottom-md") {
            h1 {
                +"Live Scoring: ${game.awayTeam.city} @ ${game.homeTeam.city}"
            }
            if (isSingleGameMode) {
                renderSingleGameHeaderActions()
            }
        }
    }
}

private fun kotlinx.html.DIV.renderSingleGameHeaderActions() {
    div(classes = "flex-gap-sm") {
        if (localEvents.isNotEmpty()) {
            button(classes = "btn btn-secondary") {
                +"⎌ Undo Action"
                onClickFunction = { _: Event ->
                    undoLastLocalEvent()
                    renderCurrentTab()
                }
            }
        }
        button(classes = "btn btn-danger") {
            +"New Game"
            onClickFunction = { _: Event ->
                isResetDialogOpen = true
                renderCurrentTab()
            }
        }
    }
}

private fun renderScorerErrorCard(container: HTMLElement, errorMsg: String?) {
    container.innerHTML = ""
    container.append {
        div(classes = "card text-center padding-lg") {
            h2 { +"Failed to load Live Scorer" }
            p(classes = "text-muted") {
                +"Error: $errorMsg"
            }
            button(classes = "btn btn-primary margin-top-md") {
                +"Retry"
                onClickFunction = { _: Event -> renderCurrentTab() }
            }
        }
    }
}
