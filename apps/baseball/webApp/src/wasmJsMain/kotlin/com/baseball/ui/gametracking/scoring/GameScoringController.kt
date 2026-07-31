package com.baseball.ui.gametracking.scoring

import com.baseball.api
import com.baseball.game.GameManager
import com.baseball.game.PlayEventInput
import com.baseball.game.localAwayActivePitcherId
import com.baseball.game.localAwayLineup
import com.baseball.game.localHomeActivePitcherId
import com.baseball.game.localHomeLineup
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.HalfInning
import com.baseball.models.Player
import com.baseball.models.ScoringEventRequest
import com.baseball.models.ScoringEventType
import com.baseball.ui.core.launch
import com.baseball.ui.state.NavTabs
import com.baseball.ui.state.currentTab
import com.baseball.ui.state.isSingleGameMode
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.updateActiveTabButtons
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
                div { id = "matchup-card-mount-point" }
            }
            div(classes = "margin-top-md") {
                id = "action-grid-wrapper"
            }
        }

        val matchupMount = rightCol.querySelector("#matchup-card-mount-point") as? HTMLElement
        if (matchupMount != null) {
            renderPlateMatchupCard(matchupMount, game, homeRoster, awayRoster)
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
        val isHomeBatting = game.gameState.half == HalfInning.BOTTOM
        val currentLineup = if (isHomeBatting) localHomeLineup else localAwayLineup
        val currentPitcherId = if (isHomeBatting) localAwayActivePitcherId else localHomeActivePitcherId

        val bId = game.gameState.currentBatterId ?: currentLineup.firstOrNull()?.id ?: 101L
        val pId = game.gameState.currentPitcherId ?: currentPitcherId

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

        renderActionGridComponent(
            parent = gridEl,
            currentPitchType = optionalPitchType,
            onPitchTypeSelected = { pType ->
                optionalPitchType = pType
                renderActionGrid()
            },
            onTriggerEvent = { type -> triggerScoringEvent(type) },
            onRenderStep2 = { type, label ->
                val isHit = type in listOf(
                    ScoringEventType.SINGLE,
                    ScoringEventType.DOUBLE,
                    ScoringEventType.TRIPLE,
                    ScoringEventType.HOME_RUN
                )
                renderStep2(type, label, isHit)
            },
        )
    }
}
