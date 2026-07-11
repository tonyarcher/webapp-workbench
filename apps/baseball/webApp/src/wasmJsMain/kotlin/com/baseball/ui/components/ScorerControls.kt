package com.baseball.ui.components

import com.baseball.BaseballConstants

import com.baseball.UiConstants

import com.baseball.api
import com.baseball.game.*
import com.baseball.models.*
import com.baseball.ui.*
import org.w3c.dom.*
import kotlinx.browser.document
import kotlinx.browser.window

// Live plate matchup, scoring actions, runner advancements and team lineup substitutions controls component
fun renderGameScoringControls(
    rightCol: HTMLElement,
    game: Game,
    homeRoster: List<Player>,
    awayRoster: List<Player>,
    boxScore: BoxScore
) {
    if (game.status == GameStatus.COMPLETED) {
        rightCol.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
            style.setProperty(UiConstants.Css.PADDING, "2rem")
            appendElement(UiConstants.Html.H2) { textContent = "GAME COMPLETED" }
            val scoreStr = "${game.awayTeam.name} ${game.awayScore}, ${game.homeTeam.name} ${game.homeScore}"
            appendElement(UiConstants.Html.P) { textContent = "Final: $scoreStr" }
            
            appendElement(UiConstants.Html.BUTTON, "btn") {
                style.setProperty(UiConstants.Css.MARGIN_TOP, "1.5rem")
                textContent = "View Final Box Score"
                onClick {
                    currentTab = BaseballConstants.TAB_BOXSCORE
                    updateActiveTabButtons()
                    renderCurrentTab()
                }
            }
        }
    } else {
        rightCol.appendElement(UiConstants.Html.H2) { textContent = "Plate Matchup" }

        // Matchup Card (Scorebook Style)
        val matchupCard = rightCol.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
            style.setProperty(UiConstants.Css.BACKGROUND, "linear-gradient(135deg, rgba(27, 53, 36, 0.9) 0%, rgba(13, 26, 18, 0.95) 100%)")
            style.setProperty(UiConstants.Css.BORDER, "1px solid rgba(74, 222, 128, 0.2)")
            style.setProperty(UiConstants.Css.PADDING, "1.25rem")
            style.setProperty(UiConstants.Css.BORDER_RADIUS, "12px")
        }
        
        val vsRow = matchupCard.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.SPACE_BETWEEN)
            style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
            style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
        }
        
        // Batter info
        val batterBox = vsRow.appendElement(UiConstants.Html.DIV) { style.setProperty(UiConstants.Css.FLEX, "1") }
        batterBox.appendElement(UiConstants.Html.DIV) { textContent = "CURRENT BATTER"; style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem"); style.setProperty(UiConstants.Css.COLOR, "var(--accent-green)") }
        batterBox.appendElement(UiConstants.Html.DIV) { 
            textContent = game.gameState.currentBatterName ?: "None"
            style.setProperty(UiConstants.Css.FONT_SIZE, "1.2rem")
            style.setProperty(UiConstants.Css.FONT_WEIGHT, "800")
            style.setProperty(UiConstants.Css.COLOR, "var(--text-primary)")
        }
        val currBatter = (awayRoster + homeRoster).find { it.id == game.gameState.currentBatterId }
        batterBox.appendElement(UiConstants.Html.DIV) {
            textContent = currBatter?.let { "${it.position} | #${it.jerseyNumber} | Bat: ${it.battingHand}" } ?: ""
            style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
            style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
        }
        
        // VS divider
        vsRow.appendElement(UiConstants.Html.DIV) {
            textContent = "VS"
            style.setProperty(UiConstants.Css.FONT_SIZE, "1.3rem")
            style.setProperty(UiConstants.Css.FONT_WEIGHT, "900")
            style.setProperty(UiConstants.Css.MARGIN, "0 1.5rem")
            style.setProperty(UiConstants.Css.COLOR, "rgba(74, 222, 128, 0.4)")
        }
        
        // Pitcher info
        val pitcherBox = vsRow.appendElement(UiConstants.Html.DIV) { style.setProperty(UiConstants.Css.FLEX, "1") }
        pitcherBox.appendElement(UiConstants.Html.DIV) { textContent = "CURRENT PITCHER"; style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem"); style.setProperty(UiConstants.Css.COLOR, "var(--accent-green)") }
        pitcherBox.appendElement(UiConstants.Html.DIV) { 
            textContent = game.gameState.currentPitcherName ?: "None"
            style.setProperty(UiConstants.Css.FONT_SIZE, "1.2rem")
            style.setProperty(UiConstants.Css.FONT_WEIGHT, "800")
            style.setProperty(UiConstants.Css.COLOR, "var(--text-primary)")
        }
        val currPitcher = (awayRoster + homeRoster).find { it.id == game.gameState.currentPitcherId }
        pitcherBox.appendElement(UiConstants.Html.DIV) {
            textContent = currPitcher?.let { "${it.position} | #${it.jerseyNumber} | Throw: ${it.throwingHand}" } ?: ""
            style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
            style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
        }
 
        // Game action triggers
        val actionGridWrapper = rightCol.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.MARGIN_TOP, "1rem")
        }
        
        var optionalPitchType: String? = null
        
        fun triggerScoringEvent(
            type: ScoringEventType,
            detail: String? = null,
            isDoublePlay: Boolean = false,
            isError: Boolean = false,
            runnerAdvanceMap: Map<String, Int>? = null
        ) {
            val bId = game.gameState.currentBatterId
            val pId = game.gameState.currentPitcherId
            if (bId != null && pId != null) {
                val finalDescription = buildString {
                    if (optionalPitchType != null) {
                        append("$optionalPitchType - ")
                    }
                    if (detail != null) {
                        append(detail)
                    }
                }.takeIf { it.isNotEmpty() }

                if (isSingleGameMode) {
                    LocalGameManager.recordLocalPlayEvent(type, bId, pId, finalDescription, isDoublePlay, isError, runnerAdvanceMap)
                    renderCurrentTab()
                } else {
                    launch {
                        api.recordGameEvent(game.id!!, ScoringEventRequest(
                            eventType = type,
                            batterId = bId,
                            pitcherId = pId,
                            description = finalDescription,
                            isDoublePlay = isDoublePlay,
                            isError = isError,
                            runnerAdvanceMap = runnerAdvanceMap
                        ))
                        renderCurrentTab()
                    }
                }
            } else {
                window.alert("Please ensure a batter and pitcher are selected!")
            }
        }

        fun renderActionGrid() {
            actionGridWrapper.innerHTML = ""
            
            // Pitch Types Toggle Label
            actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.8rem")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.COLOR, "var(--accent-green)")
                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                textContent = "PITCH TYPE (OPTIONAL)"
            }
            val pitchTypeRow = actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                style.setProperty(UiConstants.Css.GAP, "0.5rem")
                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
                style.setProperty("flex-wrap", "wrap")
            }
            val pitchTypes = listOf("Fastball", "Breaking Ball", "Offspeed")
            pitchTypes.forEach { pType ->
                val isSelected = pType == optionalPitchType
                pitchTypeRow.appendElement(UiConstants.Html.BUTTON, if (isSelected) "btn btn-primary" else "btn btn-secondary") {
                    textContent = pType
                    style.setProperty(UiConstants.Css.FLEX, "1")
                    style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
                    style.setProperty(UiConstants.Css.PADDING, "0.4rem")
                    onClick {
                        optionalPitchType = if (isSelected) null else pType
                        renderActionGrid()
                    }
                }
            }
            
            fun renderStep2(type: ScoringEventType, baseLabel: String, isHit: Boolean) {
                var hasError = false
                var hasDoublePlay = false
                
                val runnerAdvances = mutableMapOf<String, Int>()
                
                fun drawStep2UI() {
                    actionGridWrapper.innerHTML = ""
                    actionGridWrapper.appendElement(UiConstants.Html.H3) {
                        textContent = "Step 2: $baseLabel Details"
                        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
                        style.setProperty(UiConstants.Css.COLOR, "var(--accent-green)")
                        style.setProperty(UiConstants.Css.FONT_SIZE, "1.2rem")
                    }
                    
                    // Modifiers Row
                    val modifiersRow = actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                        style.setProperty(UiConstants.Css.GAP, "0.5rem")
                        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
                    }
                    
                    modifiersRow.appendElement(UiConstants.Html.BUTTON, if (hasError) "btn btn-danger" else "btn btn-secondary") {
                        textContent = if (hasError) "Error Active" else "+ Add Error"
                        onClick {
                            hasError = !hasError
                            drawStep2UI()
                        }
                    }
                    
                    if (!isHit) {
                        modifiersRow.appendElement(UiConstants.Html.BUTTON, if (hasDoublePlay) "btn btn-primary" else "btn btn-secondary") {
                            textContent = if (hasDoublePlay) "Double Play Active" else "+ Add Double Play"
                            onClick {
                                hasDoublePlay = !hasDoublePlay
                                if (hasDoublePlay) {
                                    val leadRunnerId = game.gameState.runnerThirdId ?: game.gameState.runnerSecondId ?: game.gameState.runnerFirstId
                                    if (leadRunnerId != null) {
                                        runnerAdvances[leadRunnerId.toString()] = 0
                                    }
                                } else {
                                    runnerAdvances.clear()
                                }
                                drawStep2UI()
                            }
                        }
                    }
                    
                    // Runner Advancement Section
                    val r1 = game.gameState.runnerFirstId to game.gameState.runnerFirstName
                    val r2 = game.gameState.runnerSecondId to game.gameState.runnerSecondName
                    val r3 = game.gameState.runnerThirdId to game.gameState.runnerThirdName
                    
                    val activeRunners = listOfNotNull(
                        r1.first?.let { it to ("Runner on 1B: " + r1.second) },
                        r2.first?.let { it to ("Runner on 2B: " + r2.second) },
                        r3.first?.let { it to ("Runner on 3B: " + r3.second) }
                    )
                    
                    if (activeRunners.isNotEmpty() || hasError) {
                        actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                            textContent = "Runner Base Advancement (Optional)"
                            style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                            style.setProperty(UiConstants.Css.FONT_SIZE, "0.9rem")
                            style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
                            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                        }
                        
                        val runnersList = if (hasError) {
                            activeRunners + (game.gameState.currentBatterId!! to "Batter: ${game.gameState.currentBatterName}")
                        } else {
                            activeRunners
                        }
                        
                        runnersList.forEach { (runnerId, label) ->
                            val row = actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                                style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                                style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
                                style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.SPACE_BETWEEN)
                                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                                style.setProperty(UiConstants.Css.GAP, "0.5rem")
                                style.setProperty(UiConstants.Css.BACKGROUND, "rgba(255, 255, 255, 0.03)")
                                style.setProperty(UiConstants.Css.PADDING, "0.4rem")
                                style.setProperty(UiConstants.Css.BORDER_RADIUS, "4px")
                            }
                            row.appendElement(UiConstants.Html.SPAN) {
                                textContent = label
                                style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
                                style.setProperty(UiConstants.Css.FLEX, "1")
                            }
                            
                            val btnGroup = row.appendElement(UiConstants.Html.DIV) {
                                style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                                style.setProperty(UiConstants.Css.GAP, "0.2rem")
                            }
                            
                            val currentDest = runnerAdvances[runnerId.toString()]
                            
                            val options = if (runnerId == game.gameState.currentBatterId) {
                                listOf(0 to "Out", 1 to "1B", 2 to "2B", 3 to "3B", 4 to "HR")
                            } else {
                                listOf(0 to "Out", 2 to "2B", 3 to "3B", 4 to "Score")
                            }
                            
                            options.forEach { (baseVal, baseLabel) ->
                                val isSelected = currentDest == baseVal
                                val btnClass = if (isSelected) {
                                    if (baseVal == 0) "btn btn-danger" else "btn btn-primary"
                                } else "btn btn-secondary"
                                
                                btnGroup.appendElement(UiConstants.Html.BUTTON, btnClass) {
                                    textContent = baseLabel
                                    style.setProperty(UiConstants.Css.PADDING, "0.2rem 0.4rem")
                                    style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
                                    onClick {
                                        if (isSelected) {
                                            runnerAdvances.remove(runnerId.toString())
                                        } else {
                                            runnerAdvances[runnerId.toString()] = baseVal
                                        }
                                        drawStep2UI()
                                    }
                                }
                            }
                        }
                    }
                    
                    // Locations Grid
                    actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                        textContent = "Select Hit/Out Fielder to Complete Play"
                        style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                        style.setProperty(UiConstants.Css.FONT_SIZE, "0.9rem")
                        style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
                        style.setProperty(UiConstants.Css.MARGIN_TOP, "1rem")
                        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                    }
                    
                    val locGrid = actionGridWrapper.appendElement(UiConstants.Html.DIV, "action-grid") {
                        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
                    }
                    
                    val locations = if (isHit) {
                        listOf("Left Field", "Center Field", "Right Field", "Infield", "Down the Line", "Gap")
                    } else {
                        listOf("Pitcher (1)", "Catcher (2)", "1st Base (3)", "2nd Base (4)", "3rd Base (5)", "Shortstop (6)", "Left Field (7)", "Center Field (8)", "Right Field (9)")
                    }
                    
                    locations.forEach { loc ->
                        locGrid.appendElement(UiConstants.Html.BUTTON, "btn btn-action") {
                            textContent = loc
                            onClick {
                                val detail = buildString {
                                    append("$baseLabel to $loc")
                                    if (hasDoublePlay) {
                                        append(" (Double Play)")
                                    }
                                    if (hasError) {
                                        append(" (with Error)")
                                    }
                                }
                                triggerScoringEvent(type, detail, hasDoublePlay, hasError, runnerAdvances.takeIf { it.isNotEmpty() })
                            }
                        }
                    }
                    
                    // Fast fallback if they want to submit without a specific location
                    locGrid.appendElement(UiConstants.Html.BUTTON, "btn btn-action") {
                        textContent = "Unspecified Location"
                        style.setProperty(UiConstants.Css.BACKGROUND, "rgba(255, 255, 255, 0.1)")
                        onClick {
                            val detail = buildString {
                                append(baseLabel)
                                if (hasDoublePlay) {
                                    append(" (Double Play)")
                                }
                                if (hasError) {
                                    append(" (with Error)")
                                }
                            }
                            triggerScoringEvent(type, detail, hasDoublePlay, hasError, runnerAdvances.takeIf { it.isNotEmpty() })
                        }
                    }
                    
                    val btnRow = actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                        style.setProperty(UiConstants.Css.GAP, "1rem")
                    }
                    btnRow.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
                        textContent = "Cancel"
                        style.setProperty(UiConstants.Css.FLEX, "1")
                        onClick { renderActionGrid() }
                    }
                }
                
                drawStep2UI()
            }
            
            // Pitch Results Section
            actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.8rem")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.COLOR, "var(--accent-green)")
                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                textContent = "PITCH RESULTS"
            }
            val pitchGrid = actionGridWrapper.appendElement(UiConstants.Html.DIV, "action-grid") {
                style.setProperty("grid-template-columns", "repeat(3, 1fr)")
                style.setProperty(UiConstants.Css.GAP, "0.5rem")
                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.25rem")
            }
 
            listOf(
                ScoringEventType.BALL to "Ball (B+1)",
                ScoringEventType.STRIKE to "Strike (S+1)",
                ScoringEventType.FOUL to "Foul"
            ).forEach { (type, label) ->
                pitchGrid.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary btn-action") {
                    textContent = label
                    style.setProperty(UiConstants.Css.PADDING, "0.6rem")
                    onClick { triggerScoringEvent(type) }
                }
            }
 
            // Plate & In-Play Results Divider
            actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.8rem")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.COLOR, "var(--accent-green)")
                style.setProperty(UiConstants.Css.MARGIN_TOP, "1rem")
                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                style.setProperty("border-top", "1px solid rgba(255, 255, 255, 0.08)")
                style.setProperty(UiConstants.Css.PADDING_TOP, "1rem")
                textContent = "PLATE & IN-PLAY RESULTS"
            }
            
            val actionGrid = actionGridWrapper.appendElement(UiConstants.Html.DIV, "action-grid")
 
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
                val btnClass = when (type) {
                    ScoringEventType.SINGLE, ScoringEventType.DOUBLE, ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN -> "btn btn-action"
                    else -> "btn btn-secondary btn-action"
                }
                actionGrid.appendElement(UiConstants.Html.BUTTON, btnClass) {
                    textContent = label
                    onClick { 
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
        }
        
        renderActionGrid()
    }
}
