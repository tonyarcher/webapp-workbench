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
                val throwSequence = mutableListOf<Int>()
                var isUnassisted = false
                
                val runnerAdvances = mutableMapOf<String, Int>()
                
                // Pre-populate forced advancements (sane defaults)
                val batterBase = when (type) {
                    ScoringEventType.SINGLE, ScoringEventType.WALK, ScoringEventType.HIT_BY_PITCH, ScoringEventType.ERROR, ScoringEventType.FIELDER_CHOICE -> 1
                    ScoringEventType.DOUBLE -> 2
                    ScoringEventType.TRIPLE -> 3
                    ScoringEventType.HOME_RUN -> 4
                    else -> 0
                }
                
                if (batterBase > 0) {
                    var currentLeadingReq = batterBase
                    
                    // 1B Runner
                    val r1Id = game.gameState.runnerFirstId
                    if (r1Id != null) {
                        val r1Dest = currentLeadingReq + 1
                        runnerAdvances[r1Id.toString()] = minOf(4, r1Dest)
                        currentLeadingReq = r1Dest
                    }
                    
                    // 2B Runner
                    val r2Id = game.gameState.runnerSecondId
                    if (r2Id != null) {
                        val isR2Forced = (r1Id != null && currentLeadingReq >= 2) || batterBase >= 2
                        if (isR2Forced) {
                            val r2Dest = maxOf(currentLeadingReq + 1, batterBase + 1)
                            runnerAdvances[r2Id.toString()] = minOf(4, r2Dest)
                            currentLeadingReq = r2Dest
                        }
                    }
                    
                    // 3B Runner
                    val r3Id = game.gameState.runnerThirdId
                    if (r3Id != null) {
                        val isR3Forced = (r2Id != null && runnerAdvances[r2Id.toString()] != null) || batterBase >= 3
                        if (isR3Forced) {
                            val r3Dest = maxOf(currentLeadingReq + 1, batterBase + 1)
                            runnerAdvances[r3Id.toString()] = minOf(4, r3Dest)
                        }
                    }
                }
                
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
                                            
                                            // Enforce trailing/leading runner constraints
                                            if (baseVal > 0) {
                                                val startBase = when (runnerId) {
                                                    game.gameState.currentBatterId -> 0
                                                    game.gameState.runnerFirstId -> 1
                                                    game.gameState.runnerSecondId -> 2
                                                    game.gameState.runnerThirdId -> 3
                                                    else -> 0
                                                }
                                                
                                                val otherRunners = listOfNotNull(
                                                    game.gameState.runnerFirstId?.let { it.toString() to 1 },
                                                    game.gameState.runnerSecondId?.let { it.toString() to 2 },
                                                    game.gameState.runnerThirdId?.let { it.toString() to 3 },
                                                    game.gameState.currentBatterId?.let { it.toString() to 0 }
                                                )
                                                
                                                otherRunners.forEach { (oId, oStart) ->
                                                    if (oId != runnerId.toString()) {
                                                        val oDest = runnerAdvances[oId]
                                                        if (oDest != null && oDest > 0) {
                                                            if (oStart > startBase) { // leading runner
                                                                val minDest = baseVal + (oStart - startBase)
                                                                if (oDest < minDest) {
                                                                    runnerAdvances[oId] = minOf(4, minDest)
                                                                }
                                                            } else { // trailing runner
                                                                val maxDest = baseVal - (startBase - oStart)
                                                                if (oDest > maxDest) {
                                                                    runnerAdvances[oId] = maxOf(1, maxDest)
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        drawStep2UI()
                                    }
                                }
                            }
                        }
                    }
                    
                    val showThrowBuilder = type in listOf(ScoringEventType.GROUNDOUT, ScoringEventType.FIELDER_CHOICE) || hasDoublePlay || runnerAdvances.values.contains(0)
                    if (showThrowBuilder) {
                        actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                            textContent = "Defensive Play / Throw Sequence"
                            style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                            style.setProperty(UiConstants.Css.FONT_SIZE, "0.9rem")
                            style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
                            style.setProperty(UiConstants.Css.MARGIN_TOP, "1rem")
                            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                        }
                        
                        val displaySeq = buildString {
                            if (throwSequence.isEmpty()) {
                                append("No throws (Unassisted/Direct)")
                            } else {
                                append(throwSequence.joinToString("-"))
                                if (isUnassisted) append("U")
                            }
                        }
                        
                        actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                            textContent = "Sequence: $displaySeq"
                            style.setProperty(UiConstants.Css.PADDING, "0.5rem")
                            style.setProperty(UiConstants.Css.BACKGROUND, "rgba(255, 255, 255, 0.05)")
                            style.setProperty(UiConstants.Css.BORDER, "1px solid #5a544a")
                            style.setProperty(UiConstants.Css.BORDER_RADIUS, "4px")
                            style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                            style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
                            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                        }
                        
                        val throwBtnRow = actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                            style.setProperty(UiConstants.Css.GAP, "4px")
                            style.setProperty("flex-wrap", "wrap")
                            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
                        }
                        
                        val posLabels = listOf("1-P", "2-C", "3-1B", "4-2B", "5-3B", "6-SS", "7-LF", "8-CF", "9-RF")
                        posLabels.forEachIndexed { idx, label ->
                            val posNum = idx + 1
                            throwBtnRow.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
                                textContent = label
                                style.setProperty(UiConstants.Css.PADDING, "4px 8px")
                                style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
                                onClick {
                                    if (throwSequence.size < 6) {
                                        throwSequence.add(posNum)
                                        drawStep2UI()
                                    }
                                }
                            }
                        }
                        
                        throwBtnRow.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
                            textContent = "U"
                            style.setProperty(UiConstants.Css.PADDING, "4px 8px")
                            style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
                            onClick {
                                isUnassisted = !isUnassisted
                                drawStep2UI()
                            }
                        }
                        
                        throwBtnRow.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
                            textContent = "⌫"
                            style.setProperty(UiConstants.Css.PADDING, "4px 8px")
                            style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
                            onClick {
                                if (throwSequence.isNotEmpty()) {
                                    throwSequence.removeAt(throwSequence.size - 1)
                                }
                                drawStep2UI()
                            }
                        }
                        
                        throwBtnRow.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
                            textContent = "Clear"
                            style.setProperty(UiConstants.Css.PADDING, "4px 8px")
                            style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
                            onClick {
                                throwSequence.clear()
                                isUnassisted = false
                                drawStep2UI()
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
                                val seqStr = if (throwSequence.isNotEmpty()) {
                                    val s = throwSequence.joinToString("-")
                                    if (isUnassisted) "${s}U" else s
                                } else if (isUnassisted) "3U" else null
                                
                                val detail = buildString {
                                    if (seqStr != null) {
                                        if (runnerAdvances.values.contains(0)) {
                                            append("$baseLabel to $loc (Runner Out: $seqStr)")
                                        } else {
                                            append("$baseLabel: $seqStr")
                                        }
                                    } else {
                                        append("$baseLabel to $loc")
                                    }
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
                            val seqStr = if (throwSequence.isNotEmpty()) {
                                val s = throwSequence.joinToString("-")
                                    if (isUnassisted) "${s}U" else s
                            } else if (isUnassisted) "3U" else null
                            
                            val detail = buildString {
                                if (seqStr != null) {
                                    if (runnerAdvances.values.contains(0)) {
                                        append("$baseLabel (Runner Out: $seqStr)")
                                    } else {
                                        append("$baseLabel: $seqStr")
                                    }
                                } else {
                                    append(baseLabel)
                                }
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
                
                drawStep2UI()            }

            fun renderBaseRunningStep2(type: ScoringEventType, baseLabel: String) {
                var selectedRunnerId: String? = null
                val throwSequence = mutableListOf<Int>()
                var isUnassisted = false
                
                val r1 = game.gameState.runnerFirstId to game.gameState.runnerFirstName
                val r2 = game.gameState.runnerSecondId to game.gameState.runnerSecondName
                val r3 = game.gameState.runnerThirdId to game.gameState.runnerThirdName
                val activeRunners = listOfNotNull(
                    r1.first?.let { it.toString() to ("Runner on 1B: " + r1.second) },
                    r2.first?.let { it.toString() to ("Runner on 2B: " + r2.second) },
                    r3.first?.let { it.toString() to ("Runner on 3B: " + r3.second) }
                )
                
                val runnerAdvances = mutableMapOf<String, Int>()
                
                fun drawBaseRunningUI() {
                    actionGridWrapper.innerHTML = ""
                    actionGridWrapper.appendElement(UiConstants.Html.H3) {
                        textContent = "Base Running: $baseLabel"
                        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
                        style.setProperty(UiConstants.Css.COLOR, "var(--accent-green)")
                        style.setProperty(UiConstants.Css.FONT_SIZE, "1.2rem")
                    }
                    
                    if (type == ScoringEventType.WILD_PITCH || type == ScoringEventType.PASSED_BALL || type == ScoringEventType.BALK) {
                        if (activeRunners.isEmpty()) {
                            actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                                textContent = "No runners currently on base."
                                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
                                style.setProperty(UiConstants.Css.COLOR, "#777")
                            }
                        } else {
                            actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                                textContent = "Select Runner Base Advancements:"
                                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                            }
                            
                            activeRunners.forEach { (runnerId, rLabel) ->
                                val row = actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                                    style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                                    style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
                                    style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.SPACE_BETWEEN)
                                    style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                                    style.setProperty(UiConstants.Css.BACKGROUND, "rgba(255, 255, 255, 0.03)")
                                    style.setProperty(UiConstants.Css.PADDING, "0.4rem")
                                    style.setProperty(UiConstants.Css.BORDER_RADIUS, "4px")
                                }
                                row.appendElement(UiConstants.Html.SPAN) {
                                    textContent = rLabel
                                    style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
                                }
                                val btnGroup = row.appendElement(UiConstants.Html.DIV) {
                                    style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                                    style.setProperty(UiConstants.Css.GAP, "0.2rem")
                                }
                                
                                val currentDest = runnerAdvances[runnerId]
                                val options = listOf(
                                    null to "Stays",
                                    2 to "2B",
                                    3 to "3B",
                                    4 to "Score"
                                )
                                options.forEach { (baseVal, oLabel) ->
                                    val isSelected = currentDest == baseVal
                                    btnGroup.appendElement(UiConstants.Html.BUTTON, if (isSelected) "btn btn-primary" else "btn btn-secondary") {
                                        textContent = oLabel
                                        style.setProperty(UiConstants.Css.PADDING, "0.2rem 0.4rem")
                                        style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
                                        onClick {
                                            if (baseVal == null) runnerAdvances.remove(runnerId)
                                            else {
                                                runnerAdvances[runnerId] = baseVal
                                                
                                                // Enforce trailing/leading runner constraints
                                                val startBase = when (runnerId) {
                                                    game.gameState.runnerFirstId?.toString() -> 1
                                                    game.gameState.runnerSecondId?.toString() -> 2
                                                    game.gameState.runnerThirdId?.toString() -> 3
                                                    else -> 0
                                                }
                                                
                                                val otherRunners = listOfNotNull(
                                                    game.gameState.runnerFirstId?.let { it.toString() to 1 },
                                                    game.gameState.runnerSecondId?.let { it.toString() to 2 },
                                                    game.gameState.runnerThirdId?.let { it.toString() to 3 }
                                                )
                                                
                                                otherRunners.forEach { (oId, oStart) ->
                                                    if (oId != runnerId) {
                                                        val oDest = runnerAdvances[oId]
                                                        if (oDest != null && oDest > 0) {
                                                            if (oStart > startBase) { // leading runner
                                                                val minDest = baseVal + (oStart - startBase)
                                                                if (oDest < minDest) {
                                                                    runnerAdvances[oId] = minOf(4, minDest)
                                                                }
                                                            } else { // trailing runner
                                                                val maxDest = baseVal - (startBase - oStart)
                                                                if (oDest > maxDest) {
                                                                    runnerAdvances[oId] = maxOf(1, maxDest)
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            drawBaseRunningUI()
                                        }
                                    }
                                }
                            }
                        }
                        
                        val submitGrid = actionGridWrapper.appendElement(UiConstants.Html.DIV, "action-grid") {
                            style.setProperty("grid-template-columns", "repeat(3, 1fr)")
                            style.setProperty(UiConstants.Css.GAP, "0.5rem")
                            style.setProperty(UiConstants.Css.MARGIN_TOP, "1.5rem")
                        }
                        
                        listOf(
                            ScoringEventType.WILD_PITCH to "Wild Pitch",
                            ScoringEventType.PASSED_BALL to "Passed Ball",
                            ScoringEventType.BALK to "Balk"
                        ).forEach { (evType, evLabel) ->
                            submitGrid.appendElement(UiConstants.Html.BUTTON, "btn btn-action") {
                                textContent = evLabel
                                onClick {
                                    val fullMap = mutableMapOf<String, Int>()
                                    activeRunners.forEach { (rId, _) ->
                                        fullMap[rId] = runnerAdvances[rId] ?: when {
                                            r1.first?.toString() == rId -> 1
                                            r2.first?.toString() == rId -> 2
                                            r3.first?.toString() == rId -> 3
                                            else -> 1
                                        }
                                    }
                                    triggerScoringEvent(evType, evLabel, runnerAdvanceMap = fullMap)
                                }
                            }
                        }
                        
                    } else { // Stolen Base, Caught Stealing, Picked Off
                        if (activeRunners.isEmpty()) {
                            actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                                textContent = "No runners currently on base to select."
                                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
                                style.setProperty(UiConstants.Css.COLOR, "#777")
                            }
                        } else {
                            actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                                textContent = "Select Runner:"
                                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                            }
                            
                            val runnerGrid = actionGridWrapper.appendElement(UiConstants.Html.DIV, "action-grid") {
                                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
                            }
                            activeRunners.forEach { (rId, rLabel) ->
                                val isSel = rId == selectedRunnerId
                                runnerGrid.appendElement(UiConstants.Html.BUTTON, if (isSel) "btn btn-primary" else "btn btn-secondary") {
                                    textContent = rLabel
                                    onClick {
                                        selectedRunnerId = rId
                                        drawBaseRunningUI()
                                    }
                                }
                            }
                            
                            if (selectedRunnerId != null) {
                                if (type == ScoringEventType.STOLEN_BASE) {
                                    actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                                        textContent = "Select Target Stolen Base:"
                                        style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                                        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                                    }
                                    val targetGrid = actionGridWrapper.appendElement(UiConstants.Html.DIV, "action-grid") {
                                        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
                                    }
                                    
                                    val currentBase = when (selectedRunnerId) {
                                        r1.first?.toString() -> 1
                                        r2.first?.toString() -> 2
                                        r3.first?.toString() -> 3
                                        else -> 1
                                    }
                                    
                                    val options = mutableListOf<Pair<Int, String>>()
                                    if (currentBase < 2) options.add(2 to "Second Base (2B)")
                                    if (currentBase < 3) options.add(3 to "Third Base (3B)")
                                    options.add(4 to "Home Plate (Score)")
                                    
                                    options.forEach { (targetBase, baseLabel) ->
                                        targetGrid.appendElement(UiConstants.Html.BUTTON, "btn btn-action") {
                                            textContent = baseLabel
                                            onClick {
                                                val fullMap = mutableMapOf<String, Int>()
                                                activeRunners.forEach { (rId, _) ->
                                                    if (rId == selectedRunnerId) {
                                                        fullMap[rId] = targetBase
                                                    } else {
                                                        fullMap[rId] = when {
                                                            r1.first?.toString() == rId -> 1
                                                            r2.first?.toString() == rId -> 2
                                                            r3.first?.toString() == rId -> 3
                                                            else -> 1
                                                        }
                                                    }
                                                }
                                                val targetBaseName = when (targetBase) {
                                                    2 -> "2B"
                                                    3 -> "3B"
                                                    4 -> "Home"
                                                    else -> ""
                                                }
                                                val runnerName = activeRunners.find { it.first == selectedRunnerId }?.second?.substringAfter(": ") ?: ""
                                                triggerScoringEvent(ScoringEventType.STOLEN_BASE, "Stolen Base: $runnerName to $targetBaseName", runnerAdvanceMap = fullMap)
                                            }
                                        }
                                    }
                                } else { // Caught Stealing or Picked Off
                                    actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                                        textContent = "Defensive Throw Sequence"
                                        style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                                        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                                    }
                                    val displaySeq = buildString {
                                        if (throwSequence.isEmpty()) {
                                            append(if (type == ScoringEventType.CAUGHT_STEALING) "CS (No throws)" else "PO (No throws)")
                                        } else {
                                            append(throwSequence.joinToString("-"))
                                            if (isUnassisted) append("U")
                                        }
                                    }
                                    actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                                        textContent = "Sequence: $displaySeq"
                                        style.setProperty(UiConstants.Css.PADDING, "0.5rem")
                                        style.setProperty(UiConstants.Css.BACKGROUND, "rgba(255, 255, 255, 0.05)")
                                        style.setProperty(UiConstants.Css.BORDER, "1px solid #5a544a")
                                        style.setProperty(UiConstants.Css.BORDER_RADIUS, "4px")
                                        style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                                        style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
                                        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                                    }
                                    
                                    val throwBtnRow = actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                                        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                                        style.setProperty(UiConstants.Css.GAP, "4px")
                                        style.setProperty("flex-wrap", "wrap")
                                        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
                                    }
                                    val posLabels = listOf("1-P", "2-C", "3-1B", "4-2B", "5-3B", "6-SS", "7-LF", "8-CF", "9-RF")
                                    posLabels.forEachIndexed { idx, pLabel ->
                                        val posNum = idx + 1
                                        throwBtnRow.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
                                            textContent = pLabel
                                            style.setProperty(UiConstants.Css.PADDING, "4px 8px")
                                            style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
                                            onClick {
                                                if (throwSequence.size < 6) {
                                                    throwSequence.add(posNum)
                                                    drawBaseRunningUI()
                                                }
                                            }
                                        }
                                    }
                                    throwBtnRow.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
                                        textContent = "U"
                                        style.setProperty(UiConstants.Css.PADDING, "4px 8px")
                                        style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
                                        onClick { isUnassisted = !isUnassisted; drawBaseRunningUI() }
                                    }
                                    throwBtnRow.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
                                        textContent = "⌫"
                                        style.setProperty(UiConstants.Css.PADDING, "4px 8px")
                                        style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
                                        onClick { if (throwSequence.isNotEmpty()) throwSequence.removeAt(throwSequence.size - 1); drawBaseRunningUI() }
                                    }
                                    throwBtnRow.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
                                        textContent = "Clear"
                                        style.setProperty(UiConstants.Css.PADDING, "4px 8px")
                                        style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
                                        onClick { throwSequence.clear(); isUnassisted = false; drawBaseRunningUI() }
                                    }
                                    
                                    actionGridWrapper.appendElement(UiConstants.Html.BUTTON, "btn btn-action") {
                                        textContent = "Submit Out"
                                        style.setProperty(UiConstants.Css.MARGIN_TOP, "1rem")
                                        onClick {
                                            val seqStr = if (throwSequence.isNotEmpty()) {
                                                val s = throwSequence.joinToString("-")
                                                if (isUnassisted) "${s}U" else s
                                            } else if (type == ScoringEventType.CAUGHT_STEALING) "2-6" else "1-3"
                                            
                                            val fullMap = mutableMapOf<String, Int>()
                                            activeRunners.forEach { (rId, _) ->
                                                if (rId == selectedRunnerId) {
                                                    fullMap[rId] = 0
                                                } else {
                                                    fullMap[rId] = when {
                                                        r1.first?.toString() == rId -> 1
                                                        r2.first?.toString() == rId -> 2
                                                        r3.first?.toString() == rId -> 3
                                                        else -> 1
                                                    }
                                                }
                                            }
                                            val runnerName = activeRunners.find { it.first == selectedRunnerId }?.second?.substringAfter(": ") ?: ""
                                            val prefix = if (type == ScoringEventType.CAUGHT_STEALING) "Caught Stealing" else "Picked Off"
                                            triggerScoringEvent(type, "$prefix: $runnerName ($seqStr)", runnerAdvanceMap = fullMap)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    actionGridWrapper.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
                        textContent = "Cancel"
                        style.setProperty(UiConstants.Css.MARGIN_TOP, "1rem")
                        style.setProperty(UiConstants.Css.WIDTH, "100%")
                        onClick { renderActionGrid() }
                    }
                }
                
                drawBaseRunningUI()
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

            // Base Running Actions Divider
            actionGridWrapper.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.8rem")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.COLOR, "var(--accent-green)")
                style.setProperty(UiConstants.Css.MARGIN_TOP, "1.5rem")
                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                style.setProperty("border-top", "1px solid rgba(255, 255, 255, 0.08)")
                style.setProperty(UiConstants.Css.PADDING_TOP, "1.25rem")
                textContent = "BASE RUNNING EVENTS"
            }
            
            val baseRunningGrid = actionGridWrapper.appendElement(UiConstants.Html.DIV, "action-grid") {
                style.setProperty("grid-template-columns", "repeat(2, 1fr)")
                style.setProperty(UiConstants.Css.GAP, "0.5rem")
            }
            
            listOf(
                ScoringEventType.STOLEN_BASE to "Stolen Base",
                ScoringEventType.CAUGHT_STEALING to "Caught Stealing",
                ScoringEventType.PICKED_OFF to "Picked Off",
                ScoringEventType.WILD_PITCH to "WP / PB / Balk"
            ).forEach { (type, label) ->
                baseRunningGrid.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary btn-action") {
                    textContent = label
                    style.setProperty(UiConstants.Css.PADDING, "0.5rem")
                    onClick {
                        renderBaseRunningStep2(type, label)
                    }
                }
            }
        }
        
        renderActionGrid()
    }
}
