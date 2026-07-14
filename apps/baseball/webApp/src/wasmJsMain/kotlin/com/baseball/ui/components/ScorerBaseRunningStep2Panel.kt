package com.baseball.ui.components

import com.baseball.models.*
import com.baseball.ui.*
import org.w3c.dom.*
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.html.dom.*

class ScorerBaseRunningStep2Panel(
    private val controller: GameScoringController,
    private val eventType: ScoringEventType,
    private val baseLabel: String
) {
    private var selectedRunnerId: String? = null
    private val throwSequence = mutableListOf<Int>()
    private var isUnassisted = false
    private val runnerAdvances = mutableMapOf<String, Int>()

    fun render() {
        val gridEl = controller.actionGridWrapper ?: return
        gridEl.innerHTML = ""

        val r1 = controller.game.gameState.runnerFirstId to controller.game.gameState.runnerFirstName
        val r2 = controller.game.gameState.runnerSecondId to controller.game.gameState.runnerSecondName
        val r3 = controller.game.gameState.runnerThirdId to controller.game.gameState.runnerThirdName
        val activeRunners = listOfNotNull(
            r1.first?.let { it.toString() to ("Runner on 1B: " + r1.second) },
            r2.first?.let { it.toString() to ("Runner on 2B: " + r2.second) },
            r3.first?.let { it.toString() to ("Runner on 3B: " + r3.second) }
        )

        gridEl.append.div {
            h3 {
                +"Base Running: $baseLabel"
                style = "margin-bottom: 1rem; color: var(--accent-green); font-size: 1.2rem;"
            }

            if (eventType == ScoringEventType.WILD_PITCH || eventType == ScoringEventType.PASSED_BALL || eventType == ScoringEventType.BALK) {
                renderWildPitchPassedBallBalk(this, activeRunners, r1, r2, r3)
            } else {
                renderStealOrPickoff(this, activeRunners, r1, r2, r3)
            }
        }
    }

    private fun DIV.renderWildPitchPassedBallBalk(
        parent: DIV,
        activeRunners: List<Pair<String, String>>,
        r1: Pair<Long?, String?>,
        r2: Pair<Long?, String?>,
        r3: Pair<Long?, String?>
    ) {
        if (activeRunners.isEmpty()) {
            parent.div {
                +"No runners currently on base."
                style = "margin-bottom: 1.5rem; color: #777;"
            }
        } else {
            parent.div {
                +"Select Runner Base Advancements:"
                style = "font-weight: bold; margin-bottom: 0.5rem;"
            }
            activeRunners.forEach { (runnerId, rLabel) ->
                renderSingleRunnerAdvSelection(this, runnerId, rLabel)
            }
            renderWildPitchSubmitSection(parent, activeRunners, r1, r2, r3)
        }
    }

    private fun DIV.renderSingleRunnerAdvSelection(parent: DIV, runnerId: String, rLabel: String) {
        parent.div {
            style = "display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; background: rgba(255, 255, 255, 0.03); padding: 0.4rem; border-radius: 4px;"
            span {
                +rLabel
                style = "font-size: 0.85rem;"
            }
            div {
                style = "display: flex; gap: 0.2rem;"
                val currentDest = runnerAdvances[runnerId]
                listOf(null to "Stays", 2 to "2B", 3 to "3B", 4 to "Score").forEach { (baseVal, oLabel) ->
                    val isSelected = currentDest == baseVal
                    button(classes = if (isSelected) "btn btn-primary" else "btn btn-secondary") {
                        +oLabel
                        style = "padding: 0.2rem 0.4rem; font-size: 0.75rem;"
                        onClickFunction = {
                            if (baseVal == null) runnerAdvances.remove(runnerId)
                            else {
                                runnerAdvances[runnerId] = baseVal
                                propagateWildPitchAdvances(runnerId, baseVal)
                            }
                            render()
                        }
                    }
                }
            }
        }
    }

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

    private fun propagateWildPitchAdvances(runnerId: String, baseVal: Int) {
        val startBase = when (runnerId) {
            controller.game.gameState.runnerFirstId?.toString() -> 1
            controller.game.gameState.runnerSecondId?.toString() -> 2
            controller.game.gameState.runnerThirdId?.toString() -> 3
            else -> 0
        }
        val otherRunners = listOfNotNull(
            controller.game.gameState.runnerFirstId?.let { it.toString() to 1 },
            controller.game.gameState.runnerSecondId?.let { it.toString() to 2 },
            controller.game.gameState.runnerThirdId?.let { it.toString() to 3 }
        )
        otherRunners.forEach { (oId, oStart) ->
            if (oId != runnerId) {
                adjustRunnerDest(oId, oStart, startBase, baseVal)
            }
        }
    }

    private fun DIV.renderWildPitchSubmitSection(
        parent: DIV,
        activeRunners: List<Pair<String, String>>,
        r1: Pair<Long?, String?>,
        r2: Pair<Long?, String?>,
        r3: Pair<Long?, String?>
    ) {
        parent.div(classes = "action-grid") {
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
                        controller.triggerScoringEvent(evType, evLabel, runnerAdvanceMap = fullMap)
                    }
                }
            }
        }
    }

    private fun DIV.renderRunnerSelectionButtons(parent: DIV, activeRunners: List<Pair<String, String>>) {
        parent.div(classes = "action-grid") {
            style = "margin-bottom: 1rem;"
            activeRunners.forEach { (rId, rLabel) ->
                val isSel = rId == selectedRunnerId
                button(classes = if (isSel) "btn btn-primary" else "btn btn-secondary") {
                    +rLabel
                    onClickFunction = {
                        selectedRunnerId = rId
                        render()
                    }
                }
            }
        }
    }

    private fun DIV.renderStealOrPickoff(
        parent: DIV,
        activeRunners: List<Pair<String, String>>,
        r1: Pair<Long?, String?>,
        r2: Pair<Long?, String?>,
        r3: Pair<Long?, String?>
    ) {
        if (activeRunners.isEmpty()) {
            parent.div {
                +"No runners currently on base to select."
                style = "margin-bottom: 1.5rem; color: #777;"
            }
        } else {
            parent.div {
                +"Select Runner:"
                style = "font-weight: bold; margin-bottom: 0.5rem;"
            }
            renderRunnerSelectionButtons(parent, activeRunners)

            if (selectedRunnerId != null) {
                if (eventType == ScoringEventType.STOLEN_BASE) {
                    renderStolenBaseTargetSelection(parent, activeRunners, r1, r2, r3)
                } else {
                    renderDefenseThrowSequencePO(parent, activeRunners, r1, r2, r3)
                }
            }
        }
        button(classes = "btn btn-secondary") {
            +"Cancel"
            style = "margin-top: 1rem; width: 100%;"
            onClickFunction = { controller.renderActionGrid() }
        }
    }

    private fun buildStolenBaseMap(
        activeRunners: List<Pair<String, String>>,
        r1: Pair<Long?, String?>,
        r2: Pair<Long?, String?>,
        r3: Pair<Long?, String?>,
        targetBase: Int
    ): Map<String, Int> {
        val fullMap = mutableMapOf<String, Int>()
        activeRunners.forEach { (rId, _) ->
            fullMap[rId] = if (rId == selectedRunnerId) targetBase else when {
                r1.first?.toString() == rId -> 1
                r2.first?.toString() == rId -> 2
                r3.first?.toString() == rId -> 3
                else -> 1
            }
        }
        return fullMap
    }

    private fun getStolenBaseOptions(currentBase: Int): List<Pair<Int, String>> = buildList {
        if (currentBase < 2) add(2 to "Second Base (2B)")
        if (currentBase < 3) add(3 to "Third Base (3B)")
        add(4 to "Home Plate (Score)")
    }

    private fun performStolenBase(
        targetBase: Int,
        activeRunners: List<Pair<String, String>>,
        r1: Pair<Long?, String?>,
        r2: Pair<Long?, String?>,
        r3: Pair<Long?, String?>
    ) {
        val fullMap = buildStolenBaseMap(activeRunners, r1, r2, r3, targetBase)
        val targetBaseName = when (targetBase) {
            2 -> "2B"
            3 -> "3B"
            4 -> "Home"
            else -> ""
        }
        val runnerName = activeRunners.find { it.first == selectedRunnerId }?.second?.substringAfter(": ") ?: ""
        controller.triggerScoringEvent(ScoringEventType.STOLEN_BASE, "Stolen Base: $runnerName to $targetBaseName", runnerAdvanceMap = fullMap)
    }

    private fun renderStolenBaseTargetSelection(
        parent: DIV,
        activeRunners: List<Pair<String, String>>,
        r1: Pair<Long?, String?>,
        r2: Pair<Long?, String?>,
        r3: Pair<Long?, String?>
    ) {
        parent.div {
            +"Select Target Stolen Base:"
            style = "font-weight: bold; margin-bottom: 0.5rem;"
        }
        parent.div(classes = "action-grid") {
            style = "margin-bottom: 1rem;"
            val currentBase = when (selectedRunnerId) {
                r1.first?.toString() -> 1
                r2.first?.toString() -> 2
                r3.first?.toString() -> 3
                else -> 1
            }
            getStolenBaseOptions(currentBase).forEach { (targetBase, baseLabel) ->
                button(classes = "btn btn-action") {
                    +baseLabel
                    onClickFunction = { performStolenBase(targetBase, activeRunners, r1, r2, r3) }
                }
            }
        }
    }

    private fun renderDefenseThrowSequencePO(
        parent: DIV,
        activeRunners: List<Pair<String, String>>,
        r1: Pair<Long?, String?>,
        r2: Pair<Long?, String?>,
        r3: Pair<Long?, String?>
    ) {
        parent.div {
            +"Defensive Throw Sequence"
            style = "font-weight: bold; margin-bottom: 0.5rem;"
        }
        val displaySeq = buildString {
            if (throwSequence.isEmpty()) {
                append(if (eventType == ScoringEventType.CAUGHT_STEALING) "CS (No throws)" else "PO (No throws)")
            } else {
                append(throwSequence.joinToString("-"))
                if (isUnassisted) append("U")
            }
        }
        parent.div {
            +"Sequence: $displaySeq"
            style = "padding: 0.5rem; background: rgba(255, 255, 255, 0.05); border: 1px solid #5a544a; border-radius: 4px; font-weight: bold; text-align: center; margin-bottom: 0.5rem;"
        }
        renderThrowSequencePOButtons(parent, activeRunners, r1, r2, r3)
    }

    private fun DIV.renderThrowPOActionButtons() {
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

    private fun renderThrowSequencePOButtons(
        parent: DIV,
        activeRunners: List<Pair<String, String>>,
        r1: Pair<Long?, String?>,
        r2: Pair<Long?, String?>,
        r3: Pair<Long?, String?>
    ) {
        parent.div {
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
                            render()
                        }
                    }
                }
            }
            renderThrowPOActionButtons()
        }
        parent.button(classes = "btn btn-action") {
            +"Submit Out"
            style = "margin-top: 1rem;"
            onClickFunction = { submitPOOut(activeRunners, r1, r2, r3) }
        }
    }

    private fun submitPOOut(
        activeRunners: List<Pair<String, String>>,
        r1: Pair<Long?, String?>,
        r2: Pair<Long?, String?>,
        r3: Pair<Long?, String?>
    ) {
        val seqStr = if (throwSequence.isNotEmpty()) {
            val s = throwSequence.joinToString("-")
            if (isUnassisted) "${s}U" else s
        } else if (eventType == ScoringEventType.CAUGHT_STEALING) "2-6" else "1-3"

        val fullMap = mutableMapOf<String, Int>()
        activeRunners.forEach { (rId, _) ->
            fullMap[rId] = if (rId == selectedRunnerId) 0 else when {
                r1.first?.toString() == rId -> 1
                r2.first?.toString() == rId -> 2
                r3.first?.toString() == rId -> 3
                else -> 1
            }
        }
        val runnerName = activeRunners.find { it.first == selectedRunnerId }?.second?.substringAfter(": ") ?: ""
        val prefix = if (eventType == ScoringEventType.CAUGHT_STEALING) "Caught Stealing" else "Picked Off"
        controller.triggerScoringEvent(eventType, "$prefix: $runnerName ($seqStr)", runnerAdvanceMap = fullMap)
    }
}

fun GameScoringController.renderBaseRunningStep2(eventType: ScoringEventType, baseLabel: String) {
    val panel = ScorerBaseRunningStep2Panel(this, eventType, baseLabel)
    panel.render()
}
