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
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.html.dom.*

fun renderGameScoringControls(
    rightCol: HTMLElement,
    game: Game,
    homeRoster: List<Player>,
    awayRoster: List<Player>,
    boxScore: BoxScore
) {
    rightCol.innerHTML = ""

    if (game.status == GameStatus.COMPLETED) {
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
    } else {
        var optionalPitchType: String? = null
        var actionGridWrapper: HTMLDivElement? = null

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
                    GameManager.recordPlayEvent(type, bId, pId, finalDescription, isDoublePlay, isError, runnerAdvanceMap)
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
            val gridEl = actionGridWrapper ?: return
            gridEl.innerHTML = ""

            gridEl.append.div {
                div {
                    style = "font-size: 0.8rem; font-weight: bold; color: var(--accent-green); margin-bottom: 0.5rem;"
                    +"PITCH TYPE (OPTIONAL)"
                }

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

                fun renderStep2(type: ScoringEventType, baseLabel: String, isHit: Boolean) {
                    var hasError = false
                    var hasDoublePlay = false
                    val throwSequence = mutableListOf<Int>()
                    var isUnassisted = false
                    var hrType = "Over the Fence"

                    val runnerAdvances = mutableMapOf<String, Int>()

                    val batterBase = when (type) {
                        ScoringEventType.SINGLE, ScoringEventType.WALK, ScoringEventType.HIT_BY_PITCH, ScoringEventType.ERROR, ScoringEventType.FIELDER_CHOICE -> 1
                        ScoringEventType.DOUBLE -> 2
                        ScoringEventType.TRIPLE -> 3
                        ScoringEventType.HOME_RUN -> 4
                        else -> 0
                    }

                    if (batterBase > 0) {
                        var currentLeadingReq = batterBase

                        val r1Id = game.gameState.runnerFirstId
                        if (r1Id != null) {
                            val r1Dest = currentLeadingReq + 1
                            runnerAdvances[r1Id.toString()] = minOf(4, r1Dest)
                            currentLeadingReq = r1Dest
                        }

                        val r2Id = game.gameState.runnerSecondId
                        if (r2Id != null) {
                            val isR2Forced = (r1Id != null && currentLeadingReq >= 2) || batterBase >= 2
                            if (isR2Forced) {
                                val r2Dest = maxOf(currentLeadingReq + 1, batterBase + 1)
                                runnerAdvances[r2Id.toString()] = minOf(4, r2Dest)
                                currentLeadingReq = r2Dest
                            }
                        }

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
                        gridEl.innerHTML = ""
                        gridEl.append.div {
                            h3 {
                                +"Step 2: $baseLabel Details"
                                style = "margin-bottom: 1rem; color: var(--accent-green); font-size: 1.2rem;"
                            }

                            div {
                                style = "display: flex; gap: 0.5rem; margin-bottom: 1rem;"

                                button(classes = if (hasError) "btn btn-danger" else "btn btn-secondary") {
                                    +(if (hasError) "Error Active" else "+ Add Error")
                                    onClickFunction = {
                                        hasError = !hasError
                                        drawStep2UI()
                                    }
                                }

                                if (!isHit) {
                                    button(classes = if (hasDoublePlay) "btn btn-primary" else "btn btn-secondary") {
                                        +(if (hasDoublePlay) "Double Play Active" else "+ Add Double Play")
                                        onClickFunction = {
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
                            }

                            if (type == ScoringEventType.HOME_RUN) {
                                div {
                                    +"Home Run Type"
                                    style = "font-weight: bold; font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;"
                                }

                                div {
                                    style = "display: flex; gap: 0.5rem; margin-bottom: 1rem;"

                                    listOf("Over the Fence", "Inside the Park").forEach { opt ->
                                        val active = opt == hrType
                                        button(classes = if (active) "btn btn-primary" else "btn btn-secondary") {
                                            +opt
                                            style = "flex: 1;"
                                            onClickFunction = {
                                                hrType = opt
                                                drawStep2UI()
                                            }
                                        }
                                    }
                                }
                            }

                            val r1 = game.gameState.runnerFirstId to game.gameState.runnerFirstName
                            val r2 = game.gameState.runnerSecondId to game.gameState.runnerSecondName
                            val r3 = game.gameState.runnerThirdId to game.gameState.runnerThirdName

                            val activeRunners = listOfNotNull(
                                r1.first?.let { it to ("Runner on 1B: " + r1.second) },
                                r2.first?.let { it to ("Runner on 2B: " + r2.second) },
                                r3.first?.let { it to ("Runner on 3B: " + r3.second) }
                            )

                            if (activeRunners.isNotEmpty() || hasError) {
                                div {
                                    +"Runner Base Advancement (Optional)"
                                    style = "font-weight: bold; font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;"
                                }

                                val runnersList = if (hasError) {
                                    activeRunners + (game.gameState.currentBatterId!! to "Batter: ${game.gameState.currentBatterName}")
                                } else {
                                    activeRunners
                                }

                                runnersList.forEach { (runnerId, label) ->
                                    div {
                                        style = "display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; gap: 0.5rem; background: rgba(255, 255, 255, 0.03); padding: 0.4rem; border-radius: 4px;"

                                        span {
                                            +label
                                            style = "font-size: 0.85rem; flex: 1;"
                                        }

                                        div {
                                            style = "display: flex; gap: 0.2rem;"

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

                                                button(classes = btnClass) {
                                                    +baseLabel
                                                    style = "padding: 0.2rem 0.4rem; font-size: 0.75rem;"
                                                    onClickFunction = {
                                                        if (isSelected) {
                                                            runnerAdvances.remove(runnerId.toString())
                                                        } else {
                                                            runnerAdvances[runnerId.toString()] = baseVal

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
                                                                            if (oStart > startBase) {
                                                                                val minDest = baseVal + (oStart - startBase)
                                                                                if (oDest < minDest) {
                                                                                    runnerAdvances[oId] = minOf(4, minDest)
                                                                                }
                                                                            } else {
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
                                }
                            }

                            val showThrowBuilder = type in listOf(ScoringEventType.GROUNDOUT, ScoringEventType.FIELDER_CHOICE) || hasDoublePlay || runnerAdvances.values.contains(0)
                            if (showThrowBuilder) {
                                div {
                                    +"Defensive Play / Throw Sequence"
                                    style = "font-weight: bold; font-size: 0.9rem; color: var(--text-secondary); margin-top: 1rem; margin-bottom: 0.5rem;"
                                }

                                val displaySeq = buildString {
                                    if (throwSequence.isEmpty()) {
                                        append("No throws (Unassisted/Direct)")
                                    } else {
                                        append(throwSequence.joinToString("-"))
                                        if (isUnassisted) append("U")
                                    }
                                }

                                div {
                                    +"Sequence: $displaySeq"
                                    style = "padding: 0.5rem; background: rgba(255, 255, 255, 0.05); border: 1px solid #5a544a; border-radius: 4px; font-weight: bold; text-align: center; margin-bottom: 0.5rem;"
                                }

                                div {
                                    style = "display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 1rem;"

                                    val posLabels = listOf("1-P", "2-C", "3-1B", "4-2B", "5-3B", "6-SS", "7-LF", "8-CF", "9-RF")
                                    posLabels.forEachIndexed { idx, label ->
                                        val posNum = idx + 1
                                        button(classes = "btn btn-secondary") {
                                            +label
                                            style = "padding: 4px 8px; font-size: 0.75rem;"
                                            onClickFunction = {
                                                if (throwSequence.size < 6) {
                                                    throwSequence.add(posNum)
                                                    drawStep2UI()
                                                }
                                            }
                                        }
                                    }

                                    button(classes = "btn btn-secondary") {
                                        +"U"
                                        style = "padding: 4px 8px; font-size: 0.75rem;"
                                        onClickFunction = {
                                            isUnassisted = !isUnassisted
                                            drawStep2UI()
                                        }
                                    }

                                    button(classes = "btn btn-secondary") {
                                        +"⌫"
                                        style = "padding: 4px 8px; font-size: 0.75rem;"
                                        onClickFunction = {
                                            if (throwSequence.isNotEmpty()) {
                                                throwSequence.removeAt(throwSequence.size - 1)
                                            }
                                            drawStep2UI()
                                        }
                                    }

                                    button(classes = "btn btn-secondary") {
                                        +"Clear"
                                        style = "padding: 4px 8px; font-size: 0.75rem;"
                                        onClickFunction = {
                                            throwSequence.clear()
                                            isUnassisted = false
                                            drawStep2UI()
                                        }
                                    }
                                }
                            }

                            if (type != ScoringEventType.HOME_RUN || hrType == "Inside the Park") {
                                div {
                                    +"Select Hit/Out Fielder to Complete Play"
                                    style = "font-weight: bold; font-size: 0.9rem; color: var(--text-secondary); margin-top: 1rem; margin-bottom: 0.5rem;"
                                }

                                div(classes = "action-grid") {
                                    style = "margin-bottom: 1rem;"

                                    val locations = if (isHit) {
                                        listOf("Left Field", "Center Field", "Right Field", "Infield", "Down the Line", "Gap")
                                    } else {
                                        listOf("Pitcher (1)", "Catcher (2)", "1st Base (3)", "2nd Base (4)", "3rd Base (5)", "Shortstop (6)", "Left Field (7)", "Center Field (8)", "Right Field (9)")
                                    }

                                    locations.forEach { loc ->
                                        button(classes = "btn btn-action") {
                                            +loc
                                            onClickFunction = {
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
                                                        if (type == ScoringEventType.HOME_RUN) {
                                                            append("Inside the Park Home Run to $loc")
                                                        } else {
                                                            append("$baseLabel to $loc")
                                                        }
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

                                    button(classes = "btn btn-action") {
                                        +"Unspecified Location"
                                        style = "background: rgba(255, 255, 255, 0.1);"
                                        onClickFunction = {
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
                                }
                            } else {
                                div {
                                    style = "margin-top: 1rem; margin-bottom: 1rem;"

                                    button(classes = "btn btn-primary") {
                                        +"Complete Play (Home Run)"
                                        style = "width: 100%; padding: 0.75rem;"
                                        onClickFunction = {
                                            val detail = buildString {
                                                append("Home Run (Over the Fence)")
                                                if (hasError) {
                                                    append(" (with Error)")
                                                }
                                            }
                                            triggerScoringEvent(type, detail, false, hasError, runnerAdvances.takeIf { it.isNotEmpty() })
                                        }
                                    }
                                }
                            }

                            div {
                                style = "display: flex; gap: 1rem;"

                                button(classes = "btn btn-secondary") {
                                    +"Cancel"
                                    style = "flex: 1;"
                                    onClickFunction = { renderActionGrid() }
                                }
                            }
                        }
                    }

                    drawStep2UI()
                }

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
                        gridEl.innerHTML = ""
                        gridEl.append.div {
                            h3 {
                                +"Base Running: $baseLabel"
                                style = "margin-bottom: 1rem; color: var(--accent-green); font-size: 1.2rem;"
                            }

                            if (type == ScoringEventType.WILD_PITCH || type == ScoringEventType.PASSED_BALL || type == ScoringEventType.BALK) {
                                if (activeRunners.isEmpty()) {
                                    div {
                                        +"No runners currently on base."
                                        style = "margin-bottom: 1.5rem; color: #777;"
                                    }
                                } else {
                                    div {
                                        +"Select Runner Base Advancements:"
                                        style = "font-weight: bold; margin-bottom: 0.5rem;"
                                    }

                                    activeRunners.forEach { (runnerId, rLabel) ->
                                        div {
                                            style = "display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; background: rgba(255, 255, 255, 0.03); padding: 0.4rem; border-radius: 4px;"

                                            span {
                                                +rLabel
                                                style = "font-size: 0.85rem;"
                                            }

                                            div {
                                                style = "display: flex; gap: 0.2rem;"

                                                val currentDest = runnerAdvances[runnerId]
                                                val options = listOf(
                                                    null to "Stays",
                                                    2 to "2B",
                                                    3 to "3B",
                                                    4 to "Score"
                                                )
                                                options.forEach { (baseVal, oLabel) ->
                                                    val isSelected = currentDest == baseVal
                                                    button(classes = if (isSelected) "btn btn-primary" else "btn btn-secondary") {
                                                        +oLabel
                                                        style = "padding: 0.2rem 0.4rem; font-size: 0.75rem;"
                                                        onClickFunction = {
                                                            if (baseVal == null) runnerAdvances.remove(runnerId)
                                                            else {
                                                                runnerAdvances[runnerId] = baseVal

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
                                                                            if (oStart > startBase) {
                                                                                val minDest = baseVal + (oStart - startBase)
                                                                                if (oDest < minDest) {
                                                                                    runnerAdvances[oId] = minOf(4, minDest)
                                                                                }
                                                                            } else {
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
                                    }
                                }

                                div(classes = "action-grid") {
                                    style = "grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 1.5rem;"

                                    listOf(
                                        ScoringEventType.WILD_PITCH to "Wild Pitch",
                                        ScoringEventType.PASSED_BALL to "Passed Ball",
                                        ScoringEventType.BALK to "Balk"
                                    ).forEach { (evType, evLabel) ->
                                        button(classes = "btn btn-action") {
                                            +evLabel
                                            onClickFunction = {
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
                                }
                            } else {
                                if (activeRunners.isEmpty()) {
                                    div {
                                        +"No runners currently on base to select."
                                        style = "margin-bottom: 1.5rem; color: #777;"
                                    }
                                } else {
                                    div {
                                        +"Select Runner:"
                                        style = "font-weight: bold; margin-bottom: 0.5rem;"
                                    }

                                    div(classes = "action-grid") {
                                        style = "margin-bottom: 1rem;"

                                        activeRunners.forEach { (rId, rLabel) ->
                                            val isSel = rId == selectedRunnerId
                                            button(classes = if (isSel) "btn btn-primary" else "btn btn-secondary") {
                                                +rLabel
                                                onClickFunction = {
                                                    selectedRunnerId = rId
                                                    drawBaseRunningUI()
                                                }
                                            }
                                        }
                                    }

                                    if (selectedRunnerId != null) {
                                        if (type == ScoringEventType.STOLEN_BASE) {
                                            div {
                                                +"Select Target Stolen Base:"
                                                style = "font-weight: bold; margin-bottom: 0.5rem;"
                                            }

                                            div(classes = "action-grid") {
                                                style = "margin-bottom: 1rem;"

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
                                                    button(classes = "btn btn-action") {
                                                        +baseLabel
                                                        onClickFunction = {
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
                                            }
                                        } else {
                                            div {
                                                +"Defensive Throw Sequence"
                                                style = "font-weight: bold; margin-bottom: 0.5rem;"
                                            }

                                            val displaySeq = buildString {
                                                if (throwSequence.isEmpty()) {
                                                    append(if (type == ScoringEventType.CAUGHT_STEALING) "CS (No throws)" else "PO (No throws)")
                                                } else {
                                                    append(throwSequence.joinToString("-"))
                                                    if (isUnassisted) append("U")
                                                }
                                            }

                                            div {
                                                +"Sequence: $displaySeq"
                                                style = "padding: 0.5rem; background: rgba(255, 255, 255, 0.05); border: 1px solid #5a544a; border-radius: 4px; font-weight: bold; text-align: center; margin-bottom: 0.5rem;"
                                            }

                                            div {
                                                style = "display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 1rem;"

                                                val posLabels = listOf("1-P", "2-C", "3-1B", "4-2B", "5-3B", "6-SS", "7-LF", "8-CF", "9-RF")
                                                posLabels.forEachIndexed { idx, pLabel ->
                                                    val posNum = idx + 1
                                                    button(classes = "btn btn-secondary") {
                                                        +pLabel
                                                        style = "padding: 4px 8px; font-size: 0.75rem;"
                                                        onClickFunction = {
                                                            if (throwSequence.size < 6) {
                                                                throwSequence.add(posNum)
                                                                drawBaseRunningUI()
                                                            }
                                                        }
                                                    }
                                                }

                                                button(classes = "btn btn-secondary") {
                                                    +"U"
                                                    style = "padding: 4px 8px; font-size: 0.75rem;"
                                                    onClickFunction = {
                                                        isUnassisted = !isUnassisted
                                                        drawBaseRunningUI()
                                                    }
                                                }

                                                button(classes = "btn btn-secondary") {
                                                    +"⌫"
                                                    style = "padding: 4px 8px; font-size: 0.75rem;"
                                                    onClickFunction = {
                                                        if (throwSequence.isNotEmpty()) {
                                                            throwSequence.removeAt(throwSequence.size - 1)
                                                        }
                                                        drawBaseRunningUI()
                                                    }
                                                }

                                                button(classes = "btn btn-secondary") {
                                                    +"Clear"
                                                    style = "padding: 4px 8px; font-size: 0.75rem;"
                                                    onClickFunction = {
                                                        throwSequence.clear()
                                                        isUnassisted = false
                                                        drawBaseRunningUI()
                                                    }
                                                }
                                            }

                                            button(classes = "btn btn-action") {
                                                +"Submit Out"
                                                style = "margin-top: 1rem;"
                                                onClickFunction = {
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

                            button(classes = "btn btn-secondary") {
                                +"Cancel"
                                style = "margin-top: 1rem; width: 100%;"
                                onClickFunction = { renderActionGrid() }
                            }
                        }
                    }

                    drawBaseRunningUI()
                }

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
                }

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

        rightCol.div {
            h2 { +"Plate Matchup" }

            div {
                style = "margin-bottom: 1.5rem; background: linear-gradient(135deg, rgba(27, 53, 36, 0.9) 0%, rgba(13, 26, 18, 0.95) 100%); border: 1px solid rgba(74, 222, 128, 0.2); padding: 1.25rem; border-radius: 12px;"

                div {
                    style = "display: flex; justify-content: space-between; align-items: center; text-align: center;"

                    // Batter info
                    val currBatter = (awayRoster + homeRoster).find { it.id == game.gameState.currentBatterId }
                    div {
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

                    // VS divider
                    div {
                        +"VS"
                        style = "font-size: 1.3rem; font-weight: 900; margin: 0 1.5rem; color: rgba(74, 222, 128, 0.4);"
                    }

                    // Pitcher info
                    val currPitcher = (awayRoster + homeRoster).find { it.id == game.gameState.currentPitcherId }
                    div {
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
            }

        }

        actionGridWrapper = rightCol.div {
            style = "margin-top: 1rem;"
        }

        renderActionGrid()
    }
}
