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
import kotlinx.css.*

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
            css {
                marginTop = 1.rem
            }
        }

        renderActionGrid()
    }

    private fun renderPlateMatchupCard(parent: DIV) {
        parent.div {
            css {
                marginBottom = 1.5.rem
                put("background", "linear-gradient(135deg, rgba(27, 53, 36, 0.9) 0%, rgba(13, 26, 18, 0.95) 100%)")
                border = Border(1.px, BorderStyle.solid, Color("rgba(74, 222, 128, 0.2)"))
                padding = Padding(1.25.rem)
                borderRadius = 12.px
            }
            div {
                css {
                    display = Display.flex
                    justifyContent = JustifyContent.spaceBetween
                    alignItems = Align.center
                    textAlign = TextAlign.center
                }
                renderMatchupBatterInfo(this)
                div {
                    +"VS"
                    css {
                        fontSize = 1.3.rem
                        fontWeight = FontWeight("900")
                        margin = Margin(0.px, 1.5.rem)
                        color = Color("rgba(74, 222, 128, 0.4)")
                    }
                }
                renderMatchupPitcherInfo(this)
            }
        }
    }

    private fun DIV.renderMatchupBatterInfo(parent: DIV) {
        val currBatter = (awayRoster + homeRoster).find { it.id == game.gameState.currentBatterId }
        parent.div {
            css {
                flexGrow = 1.0
            }
            div {
                +"CURRENT BATTER"
                css {
                    fontSize = 0.75.rem
                    color = Color("var(--accent-green)")
                }
            }
            div {
                +(game.gameState.currentBatterName ?: "None")
                css {
                    fontSize = 1.2.rem
                    fontWeight = FontWeight("800")
                    color = Color("var(--text-primary)")
                }
            }
            div {
                +(currBatter?.let { "${it.position} | #${it.jerseyNumber} | Bat: ${it.battingHand}" } ?: "")
                css {
                    fontSize = 0.85.rem
                    color = Color("var(--text-secondary)")
                }
            }
        }
    }

    private fun DIV.renderMatchupPitcherInfo(parent: DIV) {
        val currPitcher = (awayRoster + homeRoster).find { it.id == game.gameState.currentPitcherId }
        parent.div {
            css {
                flexGrow = 1.0
            }
            div {
                +"CURRENT PITCHER"
                css {
                    fontSize = 0.75.rem
                    color = Color("var(--accent-green)")
                }
            }
            div {
                +(game.gameState.currentPitcherName ?: "None")
                css {
                    fontSize = 1.2.rem
                    fontWeight = FontWeight("800")
                    color = Color("var(--text-primary)")
                }
            }
            div {
                +(currPitcher?.let { "${it.position} | #${it.jerseyNumber} | Throw: ${it.throwingHand}" } ?: "")
                css {
                    fontSize = 0.85.rem
                    color = Color("var(--text-secondary)")
                }
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
                css {
                    fontSize = 0.8.rem
                    fontWeight = FontWeight.bold
                    color = Color("var(--accent-green)")
                    marginBottom = 0.5.rem
                }
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
            css {
                display = Display.flex
                gap = 0.5.rem
                marginBottom = 1.rem
                flexWrap = FlexWrap.wrap
            }
            val pitchTypes = listOf("Fastball", "Breaking Ball", "Offspeed")
            pitchTypes.forEach { pType ->
                val isSelected = pType == optionalPitchType
                button(classes = if (isSelected) "btn btn-primary" else "btn btn-secondary") {
                    +pType
                    css {
                        flexGrow = 1.0
                        fontSize = 0.85.rem
                        padding = Padding(0.4.rem)
                    }
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
            css {
                fontSize = 0.8.rem
                fontWeight = FontWeight.bold
                color = Color("var(--accent-green)")
                marginBottom = 0.5.rem
            }
            +"PITCH RESULTS"
        }
        div(classes = "action-grid") {
            css {
                put("grid-template-columns", "repeat(3, 1fr)")
                gap = 0.5.rem
                marginBottom = 1.25.rem
            }
            listOf(
                ScoringEventType.BALL to "Ball (B+1)",
                ScoringEventType.STRIKE to "Strike (S+1)",
                ScoringEventType.FOUL to "Foul"
            ).forEach { (type, label) ->
                button(classes = "btn btn-secondary btn-action") {
                    +label
                    css {
                        padding = Padding(0.6.rem)
                    }
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
            css {
                fontSize = 0.8.rem
                fontWeight = FontWeight.bold
                color = Color("var(--accent-green)")
                marginTop = 1.rem
                marginBottom = 0.5.rem
                borderTop = Border(1.px, BorderStyle.solid, Color("rgba(255, 255, 255, 0.08)"))
                paddingTop = 1.rem
            }
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
            css {
                fontSize = 0.8.rem
                fontWeight = FontWeight.bold
                color = Color("var(--accent-green)")
                marginTop = 1.5.rem
                marginBottom = 0.5.rem
                borderTop = Border(1.px, BorderStyle.solid, Color("rgba(255, 255, 255, 0.08)"))
                paddingTop = 1.25.rem
            }
            +"BASE RUNNING EVENTS"
        }
        div(classes = "action-grid") {
            css {
                put("grid-template-columns", "repeat(2, 1fr)")
                gap = 0.5.rem
            }
            listOf(
                ScoringEventType.STOLEN_BASE to "Stolen Base",
                ScoringEventType.CAUGHT_STEALING to "Caught Stealing",
                ScoringEventType.PICKED_OFF to "Picked Off",
                ScoringEventType.WILD_PITCH to "WP / PB / Balk"
            ).forEach { (type, label) ->
                button(classes = "btn btn-secondary btn-action") {
                    +label
                    css {
                        padding = Padding(0.5.rem)
                    }
                    onClickFunction = {
                        renderBaseRunningStep2(type, label)
                    }
                }
            }
        }
    }
}
