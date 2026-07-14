package com.baseball.ui.components

import com.baseball.models.*
import com.baseball.ui.*
import org.w3c.dom.*
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.html.dom.*

class ScorerStep2Panel(
    private val controller: GameScoringController,
    private val eventType: ScoringEventType,
    private val baseLabel: String,
    private val isHit: Boolean
) {
    private var hasError = false
    private var hasDoublePlay = false
    private val throwSequence = mutableListOf<Int>()
    private var isUnassisted = false
    private var hrType = "Over the Fence"
    private val runnerAdvances = mutableMapOf<String, Int>()

    init {
        initializeAdvances()
    }

    private fun getBatterBase(): Int = when (eventType) {
        ScoringEventType.SINGLE, ScoringEventType.WALK, ScoringEventType.HIT_BY_PITCH, ScoringEventType.ERROR, ScoringEventType.FIELDER_CHOICE -> 1
        ScoringEventType.DOUBLE -> 2
        ScoringEventType.TRIPLE -> 3
        ScoringEventType.HOME_RUN -> 4
        else -> 0
    }

    private fun initializeAdvances() {
        val batterBase = getBatterBase()
        if (batterBase <= 0) return
        var currentLeading = batterBase

        controller.game.gameState.runnerFirstId?.let { r1 ->
            runnerAdvances[r1.toString()] = minOf(4, currentLeading + 1)
            currentLeading = currentLeading + 1
        }
        controller.game.gameState.runnerSecondId?.let { r2 ->
            if (controller.game.gameState.runnerFirstId != null && currentLeading >= 2 || batterBase >= 2) {
                val r2Dest = maxOf(currentLeading + 1, batterBase + 1)
                runnerAdvances[r2.toString()] = minOf(4, r2Dest)
                currentLeading = r2Dest
            }
        }
        controller.game.gameState.runnerThirdId?.let { r3 ->
            if (runnerAdvances[controller.game.gameState.runnerSecondId.toString()] != null || batterBase >= 3) {
                runnerAdvances[r3.toString()] = minOf(4, maxOf(currentLeading + 1, batterBase + 1))
            }
        }
    }

    fun render() {
        val gridEl = controller.actionGridWrapper ?: return
        gridEl.innerHTML = ""

        gridEl.append.div {
            h3 {
                +"Step 2: $baseLabel Details"
                style = "margin-bottom: 1rem; color: var(--accent-green); font-size: 1.2rem;"
            }
            renderOptionsBar(this)
            if (eventType == ScoringEventType.HOME_RUN) {
                renderHomeRunOptions(this)
            }
            renderRunnersAdvancement(this)
            renderThrowSequenceSection(this)
            renderFielderGridSection(this)
            renderFooter(this)
        }
    }

    private fun DIV.renderDoublePlayButton() {
        button(classes = if (hasDoublePlay) "btn btn-primary" else "btn btn-secondary") {
            +(if (hasDoublePlay) "Double Play Active" else "+ Add Double Play")
            onClickFunction = {
                hasDoublePlay = !hasDoublePlay
                if (hasDoublePlay) {
                    val leadRunnerId = controller.game.gameState.runnerThirdId
                        ?: controller.game.gameState.runnerSecondId
                        ?: controller.game.gameState.runnerFirstId
                    if (leadRunnerId != null) {
                        runnerAdvances[leadRunnerId.toString()] = 0
                    }
                } else {
                    runnerAdvances.clear()
                    initializeAdvances()
                }
                render()
            }
        }
    }

    private fun DIV.renderOptionsBar(parent: DIV) {
        parent.div {
            style = "display: flex; gap: 0.5rem; margin-bottom: 1rem;"
            button(classes = if (hasError) "btn btn-danger" else "btn btn-secondary") {
                +(if (hasError) "Error Active" else "+ Add Error")
                onClickFunction = {
                    hasError = !hasError
                    render()
                }
            }
            if (!isHit) {
                renderDoublePlayButton()
            }
        }
    }

    private fun DIV.renderHomeRunOptions(parent: DIV) {
        parent.div {
            +"Home Run Type"
            style = "font-weight: bold; font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;"
        }
        parent.div {
            style = "display: flex; gap: 0.5rem; margin-bottom: 1rem;"
            listOf("Over the Fence", "Inside the Park").forEach { opt ->
                val active = opt == hrType
                button(classes = if (active) "btn btn-primary" else "btn btn-secondary") {
                    +opt
                    style = "flex: 1;"
                    onClickFunction = {
                        hrType = opt
                        render()
                    }
                }
            }
        }
    }

    private fun DIV.renderRunnersAdvancement(parent: DIV) {
        val r1 = controller.game.gameState.runnerFirstId to controller.game.gameState.runnerFirstName
        val r2 = controller.game.gameState.runnerSecondId to controller.game.gameState.runnerSecondName
        val r3 = controller.game.gameState.runnerThirdId to controller.game.gameState.runnerThirdName

        val activeRunners = listOfNotNull(
            r1.first?.let { it to ("Runner on 1B: " + r1.second) },
            r2.first?.let { it to ("Runner on 2B: " + r2.second) },
            r3.first?.let { it to ("Runner on 3B: " + r3.second) }
        )

        if (activeRunners.isNotEmpty() || hasError) {
            parent.div {
                +"Runner Base Advancement (Optional)"
                style = "font-weight: bold; font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;"
            }
            val runnersList = if (hasError) {
                activeRunners + (controller.game.gameState.currentBatterId!! to "Batter: ${controller.game.gameState.currentBatterName}")
            } else {
                activeRunners
            }
            runnersList.forEach { (runnerId, label) ->
                renderSingleRunnerAdvancement(this, runnerId, label)
            }
        }
    }

    private fun DIV.renderAdvButton(runnerId: Long, baseVal: Int, baseLabel: String, currentDest: Int?) {
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
                    propagateForcedAdvances(runnerId, baseVal)
                }
                render()
            }
        }
    }

    private fun DIV.renderSingleRunnerAdvancement(parent: DIV, runnerId: Long, label: String) {
        parent.div {
            style = "display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; gap: 0.5rem; background: rgba(255, 255, 255, 0.03); padding: 0.4rem; border-radius: 4px;"
            span {
                +label
                style = "font-size: 0.85rem; flex: 1;"
            }
            div {
                style = "display: flex; gap: 0.2rem;"
                val currentDest = runnerAdvances[runnerId.toString()]
                val options = if (runnerId == controller.game.gameState.currentBatterId) {
                    listOf(0 to "Out", 1 to "1B", 2 to "2B", 3 to "3B", 4 to "HR")
                } else {
                    listOf(0 to "Out", 2 to "2B", 3 to "3B", 4 to "Score")
                }
                options.forEach { (baseVal, baseLabel) ->
                    renderAdvButton(runnerId, baseVal, baseLabel, currentDest)
                }
            }
        }
    }

    private fun getStartBase(runnerId: Long): Int = when (runnerId) {
        controller.game.gameState.runnerFirstId -> 1
        controller.game.gameState.runnerSecondId -> 2
        controller.game.gameState.runnerThirdId -> 3
        else -> 0
    }

    private fun getOtherRunners(): List<Pair<String, Int>> = listOfNotNull(
        controller.game.gameState.runnerFirstId?.let { it.toString() to 1 },
        controller.game.gameState.runnerSecondId?.let { it.toString() to 2 },
        controller.game.gameState.runnerThirdId?.let { it.toString() to 3 },
        controller.game.gameState.currentBatterId?.let { it.toString() to 0 }
    )

    private fun adjustRunnerDest(oId: String, oStart: Int, startBase: Int, baseVal: Int) {
        val oDest = runnerAdvances[oId] ?: return
        if (oDest <= 0) return
        if (oStart > startBase) {
            val minDest = baseVal + (oStart - startBase)
            if (oDest < minDest) runnerAdvances[oId] = minOf(4, minDest)
        } else {
            val maxDest = baseVal - (startBase - oStart)
            if (oDest > maxDest) runnerAdvances[oId] = maxOf(1, maxDest)
        }
    }

    private fun propagateForcedAdvances(runnerId: Long, baseVal: Int) {
        if (baseVal <= 0) return
        val startBase = getStartBase(runnerId)
        val otherRunners = getOtherRunners()
        otherRunners.forEach { (oId, oStart) ->
            if (oId != runnerId.toString()) {
                adjustRunnerDest(oId, oStart, startBase, baseVal)
            }
        }
    }

    private fun DIV.renderThrowSequenceSection(parent: DIV) {
        val showThrowBuilder = eventType in listOf(ScoringEventType.GROUNDOUT, ScoringEventType.FIELDER_CHOICE) || hasDoublePlay || runnerAdvances.values.contains(0)
        if (!showThrowBuilder) return

        parent.div {
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
        parent.div {
            +"Sequence: $displaySeq"
            style = "padding: 0.5rem; background: rgba(255, 255, 255, 0.05); border: 1px solid #5a544a; border-radius: 4px; font-weight: bold; text-align: center; margin-bottom: 0.5rem;"
        }
        renderThrowBuilderButtons(parent)
    }

    private fun renderThrowBuilderButtons(parent: DIV) {
        parent.div {
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
                            render()
                        }
                    }
                }
            }
            listOf("U" to { isUnassisted = !isUnassisted }, "⌫" to { if (throwSequence.isNotEmpty()) throwSequence.removeAt(throwSequence.size - 1) }, "Clear" to { throwSequence.clear(); isUnassisted = false }).forEach { (lbl, action) ->
                button(classes = "btn btn-secondary") {
                    +lbl
                    style = "padding: 4px 8px; font-size: 0.75rem;"
                    onClickFunction = {
                        action()
                        render()
                    }
                }
            }
        }
    }

    private fun DIV.renderFielderGridSection(parent: DIV) {
        if (eventType == ScoringEventType.HOME_RUN && hrType == "Over the Fence") {
            parent.div {
                style = "margin-top: 1rem; margin-bottom: 1rem;"
                button(classes = "btn btn-primary") {
                    +"Complete Play (Home Run)"
                    style = "width: 100%; padding: 0.75rem;"
                    onClickFunction = {
                        val detail = "Home Run (Over the Fence)" + if (hasError) " (with Error)" else ""
                        controller.triggerScoringEvent(eventType, detail, false, hasError, runnerAdvances.takeIf { it.isNotEmpty() })
                    }
                }
            }
        } else {
            parent.div {
                +"Select Hit/Out Fielder to Complete Play"
                style = "font-weight: bold; font-size: 0.9rem; color: var(--text-secondary); margin-top: 1rem; margin-bottom: 0.5rem;"
            }
            renderFielderButtons(parent)
        }
    }

    private fun renderFielderButtons(parent: DIV) {
        parent.div(classes = "action-grid") {
            style = "margin-bottom: 1rem;"
            val locations = if (isHit) {
                listOf("Left Field", "Center Field", "Right Field", "Infield", "Down the Line", "Gap")
            } else {
                listOf("Pitcher (1)", "Catcher (2)", "1st Base (3)", "2nd Base (4)", "3rd Base (5)", "Shortstop (6)", "Left Field (7)", "Center Field (8)", "Right Field (9)")
            }
            locations.forEach { loc ->
                button(classes = "btn btn-action") {
                    +loc
                    onClickFunction = { submitPlayWithLocation(loc) }
                }
            }
            button(classes = "btn btn-action") {
                +"Unspecified Location"
                style = "background: rgba(255, 255, 255, 0.1);"
                onClickFunction = { submitPlayWithLocation(null) }
            }
        }
    }

    private fun submitPlayWithLocation(loc: String?) {
        val seqStr = if (throwSequence.isNotEmpty()) {
            val s = throwSequence.joinToString("-")
            if (isUnassisted) "${s}U" else s
        } else if (isUnassisted) "3U" else null

        val detail = buildString {
            if (seqStr != null) {
                if (runnerAdvances.values.contains(0)) {
                    append("$baseLabel" + (if (loc != null) " to $loc" else "") + " (Runner Out: $seqStr)")
                } else {
                    append("$baseLabel: $seqStr")
                }
            } else {
                if (eventType == ScoringEventType.HOME_RUN) {
                    append("Inside the Park Home Run to " + (loc ?: "Unspecified"))
                } else {
                    append("$baseLabel" + (if (loc != null) " to $loc" else ""))
                }
            }
            if (hasDoublePlay) append(" (Double Play)")
            if (hasError) append(" (with Error)")
        }
        controller.triggerScoringEvent(eventType, detail, hasDoublePlay, hasError, runnerAdvances.takeIf { it.isNotEmpty() })
    }

    private fun DIV.renderFooter(parent: DIV) {
        parent.div {
            style = "display: flex; gap: 1rem;"
            button(classes = "btn btn-secondary") {
                +"Cancel"
                style = "flex: 1;"
                onClickFunction = { controller.renderActionGrid() }
            }
        }
    }
}

fun GameScoringController.renderStep2(eventType: ScoringEventType, baseLabel: String, isHit: Boolean) {
    val panel = ScorerStep2Panel(this, eventType, baseLabel, isHit)
    panel.render()
}
