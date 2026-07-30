package com.baseball.ui.tabs.scorer

import com.baseball.api
import com.baseball.game.clearLiveScorerCache
import com.baseball.game.resetLocalGame
import com.baseball.ui.core.UiConstants
import com.baseball.ui.core.css
import com.baseball.ui.core.launch
import com.baseball.ui.gametracking.lineup.isLineupDialogOpen
import com.baseball.ui.state.isSingleGameMode
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.selectedGameId
import kotlinx.css.Align
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.FlexDirection
import kotlinx.css.JustifyContent
import kotlinx.css.LinearDimension
import kotlinx.css.Padding
import kotlinx.css.Position
import kotlinx.css.TextAlign
import kotlinx.css.alignItems
import kotlinx.css.background
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.flexDirection
import kotlinx.css.gap
import kotlinx.css.height
import kotlinx.css.justifyContent
import kotlinx.css.left
import kotlinx.css.marginBottom
import kotlinx.css.maxWidth
import kotlinx.css.padding
import kotlinx.css.pct
import kotlinx.css.position
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.textAlign
import kotlinx.css.top
import kotlinx.css.width
import kotlinx.css.zIndex
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
        div {
            css {
                position = Position.fixed; top = 0.px; left = 0.px
                width = LinearDimension("100vw"); height = LinearDimension("100vh")
                background = "rgba(10, 15, 30, 0.8)"
                put("backdrop-filter", "blur(12px)")
                display = Display.flex; alignItems = Align.center; justifyContent = JustifyContent.center
                zIndex = 10000
            }
            div(classes = "card") {
                css {
                    width = UiConstants.MODAL_WIDTH_PCT.pct
                    maxWidth = UiConstants.MODAL_MAX_WIDTH_PX.px
                    padding = Padding(2.rem); textAlign = TextAlign.center
                }
                h2 { +"Start a New Game"; css { marginBottom = 1.rem } }
                p {
                    +"Are you sure you want to reset? All current game progress and stats will be permanently lost."
                    css { marginBottom = 1.5.rem; color = Color("var(--text-secondary)") }
                }
                renderResetGameActions()
            }
        }
    }
}

private fun kotlinx.html.DIV.renderResetGameActions() {
    div {
        css { display = Display.flex; flexDirection = FlexDirection.column; gap = 0.75.rem }
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
    button(classes = "btn btn-action") {
        +"Configure New Lineups"
        css { put("background", "linear-gradient(135deg, #3b82f6, #8b5cf6)") }
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
