package com.baseball.ui.components

import com.baseball.BaseballConstants
import com.baseball.api
import com.baseball.game.*
import com.baseball.models.*
import com.baseball.ui.*
import org.w3c.dom.*
import kotlinx.browser.window
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.html.dom.*

class GameScoringController(
    val rightCol: HTMLElement,
    val game: Game,
    val homeRoster: List<Player>,
    val awayRoster: List<Player>,
    val boxScore: BoxScore
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
        rightCol.div {
            style = "text-align: center; padding: 2rem;"
            h2 { +"GAME COMPLETED" }
            val scoreStr = "${game.awayTeam.name} ${game.awayScore}, ${game.homeTeam.name} ${game.homeScore}"
            p { +"Final: $scoreStr" }

            button(classes = "btn") {
                style = "margin-top: 1.5rem;"
                +"View Final Box Score"
                onClickFunction = {
                    currentTab = BaseballConstants.TAB_BOXSCORE
                    updateActiveTabButtons()
                    renderCurrentTab()
                }
            }
        }
    }

    private fun renderActiveGameControls() {
        rightCol.div {
            h2 { +"Plate Matchup" }
            renderPlateMatchupCard(this)
        }

        actionGridWrapper = rightCol.div {
            style = "margin-top: 1rem;"
        }

        renderActionGrid()
    }

    private fun renderPlateMatchupCard(parent: DIV) {
        parent.div {
            style = "margin-bottom: 1.5rem; background: linear-gradient(135deg, rgba(27, 53, 36, 0.9) 0%, rgba(13, 26, 18, 0.95) 100%); border: 1px solid rgba(74, 222, 128, 0.2); padding: 1.25rem; border-radius: 12px;"
            div {
                style = "display: flex; justify-content: space-between; align-items: center; text-align: center;"
                renderMatchupBatterInfo(this)
                div {
                    +"VS"
                    style = "font-size: 1.3rem; font-weight: 900; margin: 0 1.5rem; color: rgba(74, 222, 128, 0.4);"
                }
                renderMatchupPitcherInfo(this)
            }
        }
    }

    private fun DIV.renderMatchupBatterInfo(parent: DIV) {
        val currBatter = (awayRoster + homeRoster).find { it.id == game.gameState.currentBatterId }
        parent.div {
            style = "flex: 1;"
            div {
                +"CURRENT BATTER"
                style = "font-size: 0.75rem; color: var(--accent-green);"
            }
            div {
                +(game.gameState.currentBatterName ?: "None")
                style = "font-size: 1.2rem; font-weight: 800; color: var(--text-primary);"
            }
            div {
                +(currBatter?.let { "${it.position} | #${it.jerseyNumber} | Bat: ${it.battingHand}" } ?: "")
                style = "font-size: 0.85rem; color: var(--text-secondary);"
            }
        }
    }

    private fun DIV.renderMatchupPitcherInfo(parent: DIV) {
        val currPitcher = (awayRoster + homeRoster).find { it.id == game.gameState.currentPitcherId }
        parent.div {
            style = "flex: 1;"
            div {
                +"CURRENT PITCHER"
                style = "font-size: 0.75rem; color: var(--accent-green);"
            }
            div {
                +(game.gameState.currentPitcherName ?: "None")
                style = "font-size: 1.2rem; font-weight: 800; color: var(--text-primary);"
            }
            div {
                +(currPitcher?.let { "${it.position} | #${it.jerseyNumber} | Throw: ${it.throwingHand}" } ?: "")
                style = "font-size: 0.85rem; color: var(--text-secondary);"
            }
        }
    }

    private fun buildFinalDesc(detail: String?): String? = buildString {
        optionalPitchType?.let { append("$it - ") }
        detail?.let { append(it) }
    }.takeIf { it.isNotEmpty() }

    private fun recordRemoteEvent(req: ScoringEventRequest) {
        launch {
            api.recordGameEvent(game.id!!, req)
            renderCurrentTab()
        }
    }

    fun triggerScoringEvent(
        type: ScoringEventType,
        detail: String? = null,
        isDoublePlay: Boolean = false,
        isError: Boolean = false,
        runnerAdvanceMap: Map<String, Int>? = null
    ) {
        val bId = game.gameState.currentBatterId
        val pId = game.gameState.currentPitcherId
        if (bId == null || pId == null) {
            window.alert("Please ensure a batter and pitcher are selected!")
            return
        }
        val finalDescription = buildFinalDesc(detail)
        if (isSingleGameMode) {
            GameManager.recordPlayEvent(type, bId, pId, finalDescription, isDoublePlay, isError, runnerAdvanceMap)
            renderCurrentTab()
        } else {
            recordRemoteEvent(ScoringEventRequest(
                eventType = type,
                batterId = bId,
                pitcherId = pId,
                description = finalDescription,
                isDoublePlay = isDoublePlay,
                isError = isError,
                runnerAdvanceMap = runnerAdvanceMap
            ))
        }
    }

    fun renderActionGrid() {
        val gridEl = actionGridWrapper ?: return
        gridEl.innerHTML = ""

        gridEl.append.div {
            div {
                style = "font-size: 0.8rem; font-weight: bold; color: var(--accent-green); margin-bottom: 0.5rem;"
                +"PITCH TYPE (OPTIONAL)"
            }
            renderPitchTypes()
            renderPitchResultsSection()
            renderPlateResultsSection()
            renderBaseRunningEventsSection()
        }
    }

    private fun DIV.renderPitchTypes() {
        div {
            style = "display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;"
            val pitchTypes = listOf("Fastball", "Breaking Ball", "Offspeed")
            pitchTypes.forEach { pType ->
                val isSelected = pType == optionalPitchType
                button(classes = if (isSelected) "btn btn-primary" else "btn btn-secondary") {
                    +pType
                    style = "flex: 1; font-size: 0.85rem; padding: 0.4rem;"
                    onClickFunction = {
                        optionalPitchType = if (isSelected) null else pType
                        renderActionGrid()
                    }
                }
            }
        }
    }

    private fun DIV.renderPitchResultsSection() {
        div {
            style = "font-size: 0.8rem; font-weight: bold; color: var(--accent-green); margin-bottom: 0.5rem;"
            +"PITCH RESULTS"
        }
        div(classes = "action-grid") {
            style = "grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 1.25rem;"
            listOf(
                ScoringEventType.BALL to "Ball (B+1)",
                ScoringEventType.STRIKE to "Strike (S+1)",
                ScoringEventType.FOUL to "Foul"
            ).forEach { (type, label) ->
                button(classes = "btn btn-secondary btn-action") {
                    +label
                    style = "padding: 0.6rem;"
                    onClickFunction = { triggerScoringEvent(type) }
                }
            }
        }
    }

    private fun DIV.renderPlateResultsButton(type: ScoringEventType, label: String) {
        val btnClass = when (type) {
            ScoringEventType.SINGLE, ScoringEventType.DOUBLE, ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN -> "btn btn-action"
            else -> "btn btn-secondary btn-action"
        }
        button(classes = btnClass) {
            +label
            onClickFunction = {
                val isHit = type in listOf(ScoringEventType.SINGLE, ScoringEventType.DOUBLE, ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN)
                val isOut = type in listOf(ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT)
                if (isHit || isOut) {
                    renderStep2(type, label, isHit)
                } else {
                    triggerScoringEvent(type)
                }
            }
        }
    }

    private fun DIV.renderPlateResultsSection() {
        div {
            style = "font-size: 0.8rem; font-weight: bold; color: var(--accent-green); margin-top: 1rem; margin-bottom: 0.5rem; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 1rem;"
            +"PLATE & IN-PLAY RESULTS"
        }
        div(classes = "action-grid") {
            listOf(
                ScoringEventType.SINGLE to "Single (1B)",
                ScoringEventType.DOUBLE to "Double (2B)",
                ScoringEventType.TRIPLE to "Triple (3B)",
                ScoringEventType.HOME_RUN to "Home Run (HR)",
                ScoringEventType.WALK to "Walk (BB)",
                ScoringEventType.HIT_BY_PITCH to "HBP",
                ScoringEventType.STRIKEOUT to "Strikeout (K)",
                ScoringEventType.GROUNDOUT to "Groundout",
                ScoringEventType.FLYOUT to "Flyout",
                ScoringEventType.LINE_OUT to "Line Out",
                ScoringEventType.POP_OUT to "Pop Out",
                ScoringEventType.SACRIFICE_FLY to "Sac Fly",
                ScoringEventType.ERROR to "Reached on Error",
                ScoringEventType.FIELDER_CHOICE to "Fielder's Choice"
            ).forEach { (type, label) ->
                renderPlateResultsButton(type, label)
            }
        }
    }

    private fun DIV.renderBaseRunningEventsSection() {
        div {
            style = "font-size: 0.8rem; font-weight: bold; color: var(--accent-green); margin-top: 1.5rem; margin-bottom: 0.5rem; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 1.25rem;"
            +"BASE RUNNING EVENTS"
        }
        div(classes = "action-grid") {
            style = "grid-template-columns: repeat(2, 1fr); gap: 0.5rem;"
            listOf(
                ScoringEventType.STOLEN_BASE to "Stolen Base",
                ScoringEventType.CAUGHT_STEALING to "Caught Stealing",
                ScoringEventType.PICKED_OFF to "Picked Off",
                ScoringEventType.WILD_PITCH to "WP / PB / Balk"
            ).forEach { (type, label) ->
                button(classes = "btn btn-secondary btn-action") {
                    +label
                    style = "padding: 0.5rem;"
                    onClickFunction = {
                        renderBaseRunningStep2(type, label)
                    }
                }
            }
        }
    }
}
