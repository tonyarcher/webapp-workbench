package com.baseball.ui.gametracking.scoring

import com.baseball.api
import com.baseball.game.GameManager
import com.baseball.game.PlayEventInput
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.Player
import com.baseball.models.ScoringEventRequest
import com.baseball.models.ScoringEventType
import com.baseball.ui.core.launch
import com.baseball.ui.state.NavTabs
import com.baseball.ui.state.currentTab
import com.baseball.ui.state.isSingleGameMode
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.updateActiveTabButtons
import kotlinx.browser.window
import kotlinx.html.DIV
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h2
import kotlinx.html.id
import kotlinx.html.js.onClickFunction
import kotlinx.html.p
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement

class GameScoringController(
    val rightCol: HTMLElement,
    val game: Game,
    val homeRoster: List<Player>,
    val awayRoster: List<Player>,
) {
    var optionalPitchType: String? = null
    var actionGridWrapper: HTMLDivElement? = null

    fun render() {
        rightCol.innerHTML = ""

        if (game.status == GameStatus.COMPLETED) {
            renderCompletedGame()
        } else {
            renderActiveGameControls()
        }
    }

    private fun renderCompletedGame() {
        rightCol.append {
            div(classes = "text-center padding-lg") {
                h2 { +"GAME COMPLETED" }
                val scoreStr = "${game.awayTeam.name} ${game.awayScore}, ${game.homeTeam.name} ${game.homeScore}"
                p { +"Final: $scoreStr" }

                button(classes = "btn margin-top-md") {
                    +"View Final Box Score"
                    onClickFunction = {
                        currentTab = NavTabs.TAB_BOXSCORE
                        updateActiveTabButtons()
                        renderCurrentTab()
                    }
                }
            }
        }
    }

    private fun renderActiveGameControls() {
        rightCol.append {
            div {
                h2 { +"Plate Matchup" }
                renderPlateMatchupCard(this, game, homeRoster, awayRoster)
            }
            div(classes = "margin-top-md") {
                id = "action-grid-wrapper"
            }
        }

        actionGridWrapper = rightCol.querySelector("#action-grid-wrapper") as? HTMLDivElement
        renderActionGrid()
    }

    private fun buildFinalDesc(detail: String?): String? =
        buildString {
            optionalPitchType?.let { append("$it - ") }
            detail?.let { append(it) }
        }.takeIf { it.isNotEmpty() }

    fun triggerScoringEvent(
        type: ScoringEventType,
        detail: String? = null,
        isDoublePlay: Boolean = false,
        isError: Boolean = false,
        runnerAdvanceMap: Map<String, Int>? = null,
    ) {
        val bId = game.gameState.currentBatterId
        val pId = game.gameState.currentPitcherId
        if (bId == null || pId == null) {
            window.alert("Please ensure a batter and pitcher are selected!")
            return
        }
        val finalDescription = buildFinalDesc(detail)
        recordEvent(PlayEventInput(type, bId, pId, finalDescription, isDoublePlay, isError, runnerAdvanceMap))
        renderCurrentTab()
    }

    private fun recordEvent(input: PlayEventInput) {
        if (isSingleGameMode) {
            GameManager.recordPlayEvent(input)
        } else {
            launch {
                api.recordGameEvent(
                    game.id!!,
                    ScoringEventRequest(
                        eventType = input.eventType,
                        batterId = input.batterId,
                        pitcherId = input.pitcherId,
                        description = input.descriptionDetail,
                        isDoublePlay = input.isDoublePlay,
                        isError = input.isError,
                        runnerAdvanceMap = input.runnerAdvanceMap,
                    ),
                )
            }
        }
    }

    fun renderActionGrid() {
        val gridEl = actionGridWrapper ?: return
        gridEl.innerHTML = ""

        gridEl.append.div {
            div(classes = "text-accent-green font-bold margin-bottom-sm") {
                +"PITCH TYPE (OPTIONAL)"
            }
            renderPitchTypes(optionalPitchType) { pType ->
                optionalPitchType = pType
                renderActionGrid()
            }
            renderPitchResultsSection { type -> triggerScoringEvent(type) }
            renderPlateResultsSection()
            renderBaseRunningEventsSection { type, label -> renderBaseRunningStep2(type, label) }
        }
    }

    private fun DIV.renderPlateResultsButton(type: ScoringEventType, label: String) {
        val isHit = type in listOf(
            ScoringEventType.SINGLE,
            ScoringEventType.DOUBLE,
            ScoringEventType.TRIPLE,
            ScoringEventType.HOME_RUN
        )
        val isOut = type in listOf(
            ScoringEventType.GROUNDOUT,
            ScoringEventType.FLYOUT,
            ScoringEventType.LINE_OUT,
            ScoringEventType.POP_OUT
        )
        val btnClass = if (isHit) "btn btn-action" else "btn btn-secondary btn-action"

        button(classes = btnClass) {
            +label
            onClickFunction = {
                if (isHit || isOut) renderStep2(type, label, isHit) else triggerScoringEvent(type)
            }
        }
    }

    private fun DIV.renderPlateResultsSection() {
        div(classes = "text-accent-green font-bold margin-top-md margin-bottom-sm") {
            +"PLATE & IN-PLAY RESULTS"
        }
        div(classes = "action-grid-3col") {
            listOf(
                ScoringEventType.SINGLE to "Single (1B)", ScoringEventType.DOUBLE to "Double (2B)",
                ScoringEventType.TRIPLE to "Triple (3B)", ScoringEventType.HOME_RUN to "Home Run (HR)",
                ScoringEventType.WALK to "Walk (BB)", ScoringEventType.HIT_BY_PITCH to "HBP",
                ScoringEventType.STRIKEOUT to "Strikeout (K)", ScoringEventType.GROUNDOUT to "Groundout",
                ScoringEventType.FLYOUT to "Flyout", ScoringEventType.LINE_OUT to "Line Out",
                ScoringEventType.POP_OUT to "Pop Out", ScoringEventType.SACRIFICE_FLY to "Sac Fly",
                ScoringEventType.ERROR to "Reached on Error", ScoringEventType.FIELDER_CHOICE to "Fielder's Choice",
            ).forEach { (type, label) -> renderPlateResultsButton(type, label) }
        }
    }
}
