package com.baseball.ui.components

import com.baseball.Constants
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
        rightCol.appendElement("div") {
            style.setProperty("text-align", "center")
            style.setProperty("padding", "2rem")
            appendElement("h2") { textContent = "GAME COMPLETED" }
            val scoreStr = "${game.awayTeam.name} ${game.awayScore}, ${game.homeTeam.name} ${game.homeScore}"
            appendElement("p") { textContent = "Final: $scoreStr" }
            
            appendElement("button", "btn") {
                style.setProperty("margin-top", "1.5rem")
                textContent = "View Final Box Score"
                onClick {
                    currentTab = "boxscore"
                    updateActiveTabButtons()
                    renderCurrentTab()
                }
            }
        }
    } else {
        rightCol.appendElement("h2") { textContent = "Plate Matchup" }

        // Matchup Card (Scorebook Style)
        val matchupCard = rightCol.appendElement("div") {
            style.setProperty("margin-bottom", "1.5rem")
            style.setProperty("background", "linear-gradient(135deg, rgba(27, 53, 36, 0.9) 0%, rgba(13, 26, 18, 0.95) 100%)")
            style.setProperty("border", "1px solid rgba(74, 222, 128, 0.2)")
            style.setProperty("padding", "1.25rem")
            style.setProperty("border-radius", "12px")
        }
        
        val vsRow = matchupCard.appendElement("div") {
            style.setProperty("display", "flex")
            style.setProperty("justify-content", "space-between")
            style.setProperty("align-items", "center")
            style.setProperty("text-align", "center")
        }
        
        // Batter info
        val batterBox = vsRow.appendElement("div") { style.setProperty("flex", "1") }
        batterBox.appendElement("div") { textContent = "CURRENT BATTER"; style.setProperty("font-size", "0.75rem"); style.setProperty("color", "var(--accent-green)") }
        batterBox.appendElement("div") { 
            textContent = game.gameState.currentBatterName ?: "None"
            style.setProperty("font-size", "1.2rem")
            style.setProperty("font-weight", "800")
            style.setProperty("color", "var(--text-primary)")
        }
        val currBatter = (awayRoster + homeRoster).find { it.id == game.gameState.currentBatterId }
        batterBox.appendElement("div") {
            textContent = currBatter?.let { "${it.position} | #${it.jerseyNumber} | Bat: ${it.battingHand}" } ?: ""
            style.setProperty("font-size", "0.85rem")
            style.setProperty("color", "var(--text-secondary)")
        }
        
        // VS divider
        vsRow.appendElement("div") {
            textContent = "VS"
            style.setProperty("font-size", "1.3rem")
            style.setProperty("font-weight", "900")
            style.setProperty("margin", "0 1.5rem")
            style.setProperty("color", "rgba(74, 222, 128, 0.4)")
        }
        
        // Pitcher info
        val pitcherBox = vsRow.appendElement("div") { style.setProperty("flex", "1") }
        pitcherBox.appendElement("div") { textContent = "CURRENT PITCHER"; style.setProperty("font-size", "0.75rem"); style.setProperty("color", "var(--accent-green)") }
        pitcherBox.appendElement("div") { 
            textContent = game.gameState.currentPitcherName ?: "None"
            style.setProperty("font-size", "1.2rem")
            style.setProperty("font-weight", "800")
            style.setProperty("color", "var(--text-primary)")
        }
        val currPitcher = (awayRoster + homeRoster).find { it.id == game.gameState.currentPitcherId }
        pitcherBox.appendElement("div") {
            textContent = currPitcher?.let { "${it.position} | #${it.jerseyNumber} | Throw: ${it.throwingHand}" } ?: ""
            style.setProperty("font-size", "0.85rem")
            style.setProperty("color", "var(--text-secondary)")
        }

        // Game action triggers
        val actionGridWrapper = rightCol.appendElement("div") {
            style.setProperty("margin-top", "1rem")
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
            actionGridWrapper.appendElement("div") {
                style.setProperty("font-size", "0.8rem")
                style.setProperty("font-weight", "bold")
                style.setProperty("color", "var(--accent-green)")
                style.setProperty("margin-bottom", "0.5rem")
                textContent = "PITCH TYPE (OPTIONAL)"
            }
            val pitchTypeRow = actionGridWrapper.appendElement("div") {
                style.setProperty("display", "flex")
                style.setProperty("gap", "0.5rem")
                style.setProperty("margin-bottom", "1rem")
                style.setProperty("flex-wrap", "wrap")
            }
            val pitchTypes = listOf("Fastball", "Breaking Ball", "Offspeed")
            pitchTypes.forEach { pType ->
                val isSelected = pType == optionalPitchType
                pitchTypeRow.appendElement("button", if (isSelected) "btn btn-primary" else "btn btn-secondary") {
                    textContent = pType
                    style.setProperty("flex", "1")
                    style.setProperty("font-size", "0.85rem")
                    style.setProperty("padding", "0.4rem")
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
                    actionGridWrapper.appendElement("h3") {
                        textContent = "Step 2: $baseLabel Details"
                        style.setProperty("margin-bottom", "1rem")
                        style.setProperty("color", "var(--accent-green)")
                        style.setProperty("font-size", "1.2rem")
                    }
                    
                    // Modifiers Row
                    val modifiersRow = actionGridWrapper.appendElement("div") {
                        style.setProperty("display", "flex")
                        style.setProperty("gap", "0.5rem")
                        style.setProperty("margin-bottom", "1rem")
                    }
                    
                    modifiersRow.appendElement("button", if (hasError) "btn btn-danger" else "btn btn-secondary") {
                        textContent = if (hasError) "Error Active" else "+ Add Error"
                        onClick {
                            hasError = !hasError
                            drawStep2UI()
                        }
                    }
                    
                    if (!isHit) {
                        modifiersRow.appendElement("button", if (hasDoublePlay) "btn btn-primary" else "btn btn-secondary") {
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
                        actionGridWrapper.appendElement("div") {
                            textContent = "Runner Base Advancement (Optional)"
                            style.setProperty("font-weight", "bold")
                            style.setProperty("font-size", "0.9rem")
                            style.setProperty("color", "var(--text-secondary)")
                            style.setProperty("margin-bottom", "0.5rem")
                        }
                        
                        val runnersList = if (hasError) {
                            activeRunners + (game.gameState.currentBatterId!! to "Batter: ${game.gameState.currentBatterName}")
                        } else {
                            activeRunners
                        }
                        
                        runnersList.forEach { (runnerId, label) ->
                            val row = actionGridWrapper.appendElement("div") {
                                style.setProperty("display", "flex")
                                style.setProperty("align-items", "center")
                                style.setProperty("justify-content", "space-between")
                                style.setProperty("margin-bottom", "0.5rem")
                                style.setProperty("gap", "0.5rem")
                                style.setProperty("background", "rgba(255, 255, 255, 0.03)")
                                style.setProperty("padding", "0.4rem")
                                style.setProperty("border-radius", "4px")
                            }
                            row.appendElement("span") {
                                textContent = label
                                style.setProperty("font-size", "0.85rem")
                                style.setProperty("flex", "1")
                            }
                            
                            val btnGroup = row.appendElement("div") {
                                style.setProperty("display", "flex")
                                style.setProperty("gap", "0.2rem")
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
                                
                                btnGroup.appendElement("button", btnClass) {
                                    textContent = baseLabel
                                    style.setProperty("padding", "0.2rem 0.4rem")
                                    style.setProperty("font-size", "0.75rem")
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
                    actionGridWrapper.appendElement("div") {
                        textContent = "Select Hit/Out Fielder to Complete Play"
                        style.setProperty("font-weight", "bold")
                        style.setProperty("font-size", "0.9rem")
                        style.setProperty("color", "var(--text-secondary)")
                        style.setProperty("margin-top", "1rem")
                        style.setProperty("margin-bottom", "0.5rem")
                    }
                    
                    val locGrid = actionGridWrapper.appendElement("div", "action-grid") {
                        style.setProperty("margin-bottom", "1rem")
                    }
                    
                    val locations = if (isHit) {
                        listOf("Left Field", "Center Field", "Right Field", "Infield", "Down the Line", "Gap")
                    } else {
                        listOf("Pitcher (1)", "Catcher (2)", "1st Base (3)", "2nd Base (4)", "3rd Base (5)", "Shortstop (6)", "Left Field (7)", "Center Field (8)", "Right Field (9)")
                    }
                    
                    locations.forEach { loc ->
                        locGrid.appendElement("button", "btn btn-action") {
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
                    locGrid.appendElement("button", "btn btn-action") {
                        textContent = "Unspecified Location"
                        style.setProperty("background", "rgba(255, 255, 255, 0.1)")
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
                    
                    val btnRow = actionGridWrapper.appendElement("div") {
                        style.setProperty("display", "flex")
                        style.setProperty("gap", "1rem")
                    }
                    btnRow.appendElement("button", "btn btn-secondary") {
                        textContent = "Cancel"
                        style.setProperty("flex", "1")
                        onClick { renderActionGrid() }
                    }
                }
                
                drawStep2UI()
            }
            
            // Pitch Results Section
            actionGridWrapper.appendElement("div") {
                style.setProperty("font-size", "0.8rem")
                style.setProperty("font-weight", "bold")
                style.setProperty("color", "var(--accent-green)")
                style.setProperty("margin-bottom", "0.5rem")
                textContent = "PITCH RESULTS"
            }
            val pitchGrid = actionGridWrapper.appendElement("div", "action-grid") {
                style.setProperty("grid-template-columns", "repeat(3, 1fr)")
                style.setProperty("gap", "0.5rem")
                style.setProperty("margin-bottom", "1.25rem")
            }

            listOf(
                ScoringEventType.BALL to "Ball (B+1)",
                ScoringEventType.STRIKE to "Strike (S+1)",
                ScoringEventType.FOUL to "Foul"
            ).forEach { (type, label) ->
                pitchGrid.appendElement("button", "btn btn-secondary btn-action") {
                    textContent = label
                    style.setProperty("padding", "0.6rem")
                    onClick { triggerScoringEvent(type) }
                }
            }

            // Plate & In-Play Results Divider
            actionGridWrapper.appendElement("div") {
                style.setProperty("font-size", "0.8rem")
                style.setProperty("font-weight", "bold")
                style.setProperty("color", "var(--accent-green)")
                style.setProperty("margin-top", "1rem")
                style.setProperty("margin-bottom", "0.5rem")
                style.setProperty("border-top", "1px solid rgba(255, 255, 255, 0.08)")
                style.setProperty("padding-top", "1rem")
                textContent = "PLATE & IN-PLAY RESULTS"
            }
            
            val actionGrid = actionGridWrapper.appendElement("div", "action-grid")

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
                actionGrid.appendElement("button", btnClass) {
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
