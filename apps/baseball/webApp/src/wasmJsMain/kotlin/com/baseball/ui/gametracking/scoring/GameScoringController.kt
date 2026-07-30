package com.baseball.ui.gametracking.scoring

import com.baseball.api
import com.baseball.game.GameManager
import com.baseball.game.PlayEventInput
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.Player
import com.baseball.models.ScoringEventRequest
import com.baseball.models.ScoringEventType
import com.baseball.ui.core.css
import com.baseball.ui.core.launch
import com.baseball.ui.state.NavTabs
import com.baseball.ui.state.currentTab
import com.baseball.ui.state.isSingleGameMode
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.updateActiveTabButtons
import kotlinx.browser.window
import kotlinx.css.Border
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.FontWeight
import kotlinx.css.Padding
import kotlinx.css.TextAlign
import kotlinx.css.borderTop
import kotlinx.css.color
import kotlinx.css.fontSize
import kotlinx.css.fontWeight
import kotlinx.css.marginBottom
import kotlinx.css.marginTop
import kotlinx.css.padding
import kotlinx.css.paddingTop
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.textAlign
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
            div {
                css {
                    textAlign = TextAlign.center
                    padding = Padding(2.rem)
                }
                h2 { +"GAME COMPLETED" }
                val scoreStr = "${game.awayTeam.name} ${game.awayScore}, ${game.homeTeam.name} ${game.homeScore}"
                p { +"Final: $scoreStr" }

                button(classes = "btn") {
                    css {
                        marginTop = 1.5.rem
                    }
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
            div {
                id = "action-grid-wrapper"
                css { marginTop = 1.rem }
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
        if (isSingleGameMode) {
            GameManager.recordPlayEvent(
                PlayEventInput(
                    eventType = type, batterId = bId, pitcherId = pId,
                    descriptionDetail = finalDescription, isDoublePlay = isDoublePlay,
                    isError = isError, runnerAdvanceMap = runnerAdvanceMap,
                )
            )
        } else {
            launch {
                api.recordGameEvent(
                    game.id!!,
                    ScoringEventRequest(
                        eventType = type, batterId = bId, pitcherId = pId,
                        description = finalDescription, isDoublePlay = isDoublePlay,
                        isError = isError, runnerAdvanceMap = runnerAdvanceMap,
                    )
                )
            }
        }
        renderCurrentTab()
    }

    fun renderActionGrid() {
        val gridEl = actionGridWrapper ?: return
        gridEl.innerHTML = ""

        gridEl.append.div {
            div {
                css {
                    fontSize = 0.8.rem; fontWeight = FontWeight.bold; color = Color("var(--accent-green)")
                    marginBottom = 0.5.rem
                }
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
        div {
            css {
                fontSize = 0.8.rem; fontWeight = FontWeight.bold; color = Color("var(--accent-green)")
                marginTop = 1.rem; marginBottom = 0.5.rem
                borderTop = Border(1.px, BorderStyle.solid, Color("rgba(255, 255, 255, 0.08)"))
                paddingTop = 1.rem
            }
            +"PLATE & IN-PLAY RESULTS"
        }
        div(classes = "action-grid") {
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
