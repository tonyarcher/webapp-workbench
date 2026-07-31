package com.baseball.ui.tabs.scorer

import com.baseball.api
import com.baseball.game.clearLiveScorerCache
import com.baseball.game.resetLocalGame
import com.baseball.ui.core.launch
import com.baseball.ui.gametracking.lineup.isLineupDialogOpen
import com.baseball.ui.state.isSingleGameMode
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.selectedGameId
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h2
import kotlinx.html.js.onClickFunction
import kotlinx.html.p
import org.w3c.dom.HTMLElement
import org.w3c.dom.events.Event

internal fun renderResetGameOverlay(container: HTMLElement) {
    container.append {
        div(classes = "modal-overlay") {
            div(classes = "card lineup-modal-content text-center") {
                h2(classes = "margin-bottom-md") { +"Start a New Game" }
                p(classes = "text-muted margin-bottom-lg") {
                    +"Are you sure you want to reset? All current game progress and stats will be permanently lost."
                }
                renderResetGameActions()
            }
        }
    }
}

private fun kotlinx.html.DIV.renderResetGameActions() {
    div(classes = "flex-gap-md") {
        if (isSingleGameMode) {
            renderSingleGameResetButtons()
        } else {
            renderMultiGameResetButtons()
        }
        renderCancelResetButton()
    }
}

private fun kotlinx.html.DIV.renderSingleGameResetButtons() {
    button(classes = "btn btn-primary") {
        +"Restart with Current Lineups"
        onClickFunction = { _: Event ->
            isResetDialogOpen = false
            resetLocalGame(toInitialLineups = true)
            renderCurrentTab()
        }
    }
    button(classes = "btn btn-gradient") {
        +"Configure New Lineups"
        onClickFunction = { _: Event ->
            isResetDialogOpen = false
            isLineupDialogOpen = true
            renderCurrentTab()
        }
    }
}

private fun kotlinx.html.DIV.renderMultiGameResetButtons() {
    button(classes = "btn btn-primary") {
        +"Reset Game Stats & Events"
        onClickFunction = { _: Event ->
            launch {
                api.resetGame(selectedGameId!!)
                clearLiveScorerCache()
                isResetDialogOpen = false
                renderCurrentTab()
            }
        }
    }
}

private fun kotlinx.html.DIV.renderCancelResetButton() {
    button(classes = "btn btn-secondary") {
        +"Cancel"
        onClickFunction = { _: Event ->
            isResetDialogOpen = false
            renderCurrentTab()
        }
    }
}
