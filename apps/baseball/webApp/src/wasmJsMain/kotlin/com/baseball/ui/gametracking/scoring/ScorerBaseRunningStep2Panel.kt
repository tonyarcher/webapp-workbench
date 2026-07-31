package com.baseball.ui.gametracking.scoring

import com.baseball.models.ScoringEventType
import kotlinx.html.DIV
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h3
import kotlinx.html.js.onClickFunction
import kotlinx.html.span

class ScorerBaseRunningStep2Panel(
    internal val controller: GameScoringController,
    internal val eventType: ScoringEventType,
    private val baseLabel: String,
) {
    internal var selectedRunnerId: String? = null
    internal val throwSequence = mutableListOf<Int>()
    internal var isUnassisted = false
    internal val runnerAdvances = mutableMapOf<String, Int>()

    fun render() {
        val gridEl = controller.actionGridWrapper ?: return
        gridEl.innerHTML = ""

        val activeRunners = getActiveRunnersList()

        gridEl.append.div {
            h3(classes = "text-accent-green font-bold margin-bottom-md") {
                +"Base Running: $baseLabel"
            }

            if (isWildPitchOrBalkEvent()) {
                WildPitchStep2Ui.renderWildPitchPassedBallBalk(this@ScorerBaseRunningStep2Panel, this, activeRunners)
            } else {
                StealPickoffStep2Ui.renderStealOrPickoff(this@ScorerBaseRunningStep2Panel, this, activeRunners)
            }
        }
    }

    private fun isWildPitchOrBalkEvent(): Boolean =
        eventType == ScoringEventType.WILD_PITCH ||
                eventType == ScoringEventType.PASSED_BALL ||
                eventType == ScoringEventType.BALK

    private fun getActiveRunnersList(): List<Pair<String, String>> {
        val st = controller.game.gameState
        val r1 = st.runnerFirstId to st.runnerFirstName
        val r2 = st.runnerSecondId to st.runnerSecondName
        val r3 = st.runnerThirdId to st.runnerThirdName
        return listOfNotNull(
            r1.first?.let { it.toString() to ("Runner on 1B: " + r1.second) },
            r2.first?.let { it.toString() to ("Runner on 2B: " + r2.second) },
            r3.first?.let { it.toString() to ("Runner on 3B: " + r3.second) },
        )
    }

    internal fun submitWildPitchOrBalk(
        evType: ScoringEventType,
        evLabel: String,
        activeRunners: List<Pair<String, String>>,
    ) {
        val gameState = controller.game.gameState
        val r1Str = gameState.runnerFirstId?.toString()
        val r2Str = gameState.runnerSecondId?.toString()
        val r3Str = gameState.runnerThirdId?.toString()

        val fullMap = mutableMapOf<String, Int>()
        activeRunners.forEach { (rId, _) ->
            fullMap[rId] = runnerAdvances[rId] ?: when {
                r1Str == rId -> 1
                r2Str == rId -> 2
                r3Str == rId -> 3
                else -> 1
            }
        }
        controller.triggerScoringEvent(evType, evLabel, runnerAdvanceMap = fullMap)
    }

    internal fun submitPOOut(activeRunners: List<Pair<String, String>>) {
        val gameState = controller.game.gameState
        val r1Str = gameState.runnerFirstId?.toString()
        val r2Str = gameState.runnerSecondId?.toString()
        val r3Str = gameState.runnerThirdId?.toString()

        val seqStr = getPoSequenceString()
        val fullMap = mutableMapOf<String, Int>()
        activeRunners.forEach { (rId, _) ->
            fullMap[rId] = if (rId == selectedRunnerId) 0 else when {
                r1Str == rId -> 1
                r2Str == rId -> 2
                r3Str == rId -> 3
                else -> 1
            }
        }
        val runnerName = activeRunners.find { it.first == selectedRunnerId }?.second?.substringAfter(": ") ?: ""
        val prefix = if (eventType == ScoringEventType.CAUGHT_STEALING) "Caught Stealing" else "Picked Off"
        controller.triggerScoringEvent(eventType, "$prefix: $runnerName ($seqStr)", runnerAdvanceMap = fullMap)
    }

    private fun getPoSequenceString(): String = when {
        throwSequence.isNotEmpty() -> {
            val s = throwSequence.joinToString("-")
            if (isUnassisted) "${s}U" else s
        }

        eventType == ScoringEventType.CAUGHT_STEALING -> "2-6"
        else -> "1-3"
    }

    internal fun performStolenBase(
        targetBase: Int,
        activeRunners: List<Pair<String, String>>,
    ) {
        val fullMap = buildStolenBaseMap(activeRunners, targetBase)
        val targetBaseName =
            when (targetBase) {
                2 -> "2B"
                3 -> "3B"
                4 -> "Home"
                else -> ""
            }
        val runnerName = activeRunners.find { it.first == selectedRunnerId }?.second?.substringAfter(": ") ?: ""
        controller.triggerScoringEvent(
            ScoringEventType.STOLEN_BASE,
            "Stolen Base: $runnerName to $targetBaseName",
            runnerAdvanceMap = fullMap,
        )
    }

    private fun buildStolenBaseMap(
        activeRunners: List<Pair<String, String>>,
        targetBase: Int,
    ): Map<String, Int> {
        val gameState = controller.game.gameState
        val r1Str = gameState.runnerFirstId?.toString()
        val r2Str = gameState.runnerSecondId?.toString()
        val r3Str = gameState.runnerThirdId?.toString()

        val fullMap = mutableMapOf<String, Int>()
        activeRunners.forEach { (rId, _) ->
            fullMap[rId] =
                if (rId == selectedRunnerId) {
                    targetBase
                } else {
                    when {
                        r1Str == rId -> 1
                        r2Str == rId -> 2
                        r3Str == rId -> 3
                        else -> 1
                    }
                }
        }
        return fullMap
    }

    internal fun getStolenBaseOptions(currentBase: Int): List<Pair<Int, String>> =
        buildList {
            if (currentBase < 2) add(2 to "Second Base (2B)")
            if (currentBase < 3) add(3 to "Third Base (3B)")
            add(4 to "Home Plate (Score)")
        }

    internal fun getDisplaySequence(): String = buildString {
        if (throwSequence.isEmpty()) {
            append(if (eventType == ScoringEventType.CAUGHT_STEALING) "CS (No throws)" else "PO (No throws)")
        } else {
            append(throwSequence.joinToString("-"))
            if (isUnassisted) append("U")
        }
    }
}

private object WildPitchStep2Ui {
    fun renderWildPitchPassedBallBalk(
        panel: ScorerBaseRunningStep2Panel,
        parent: DIV,
        activeRunners: List<Pair<String, String>>,
    ) {
        if (activeRunners.isEmpty()) {
            parent.div(classes = "text-muted margin-bottom-md") {
                +"No runners currently on base."
            }
        } else {
            parent.div(classes = "font-bold margin-bottom-sm") {
                +"Select Runner Base Advancements:"
            }
            activeRunners.forEach { (runnerId, rLabel) ->
                renderSingleRunnerAdvSelection(panel, parent, runnerId, rLabel)
            }
            renderWildPitchSubmitSection(panel, parent, activeRunners)
        }
    }

    private fun renderSingleRunnerAdvSelection(
        panel: ScorerBaseRunningStep2Panel,
        parent: DIV,
        runnerId: String,
        rLabel: String,
    ) {
        parent.div(classes = "scorer-runner-row") {
            span(classes = "font-small") {
                +rLabel
            }
            div(classes = "flex-gap-xs") {
                val currentDest = panel.runnerAdvances[runnerId]
                listOf(null to "Stays", 2 to "2B", 3 to "3B", 4 to "Score").forEach { (baseVal, oLabel) ->
                    renderAdvOptionButton(panel, runnerId, currentDest, baseVal, oLabel)
                }
            }
        }
    }

    private fun DIV.renderAdvOptionButton(
        panel: ScorerBaseRunningStep2Panel,
        runnerId: String,
        currentDest: Int?,
        baseVal: Int?,
        oLabel: String,
    ) {
        val isSelected = currentDest == baseVal
        button(classes = if (isSelected) "btn btn-primary" else "btn btn-secondary") {
            +oLabel
            onClickFunction = {
                if (baseVal == null) {
                    panel.runnerAdvances.remove(runnerId)
                } else {
                    panel.runnerAdvances[runnerId] = baseVal
                    propagateWildPitchAdvances(panel, runnerId, baseVal)
                }
                panel.render()
            }
        }
    }

    private fun adjustRunnerDest(
        panel: ScorerBaseRunningStep2Panel,
        oId: String,
        oStart: Int,
        startBase: Int,
        baseVal: Int,
    ) {
        val oDest = panel.runnerAdvances[oId] ?: return
        if (oDest <= 0) return
        if (oStart > startBase) {
            val minDest = baseVal + (oStart - startBase)
            if (oDest < minDest) panel.runnerAdvances[oId] = minOf(4, minDest)
        } else {
            val maxDest = baseVal - (startBase - oStart)
            if (oDest > maxDest) panel.runnerAdvances[oId] = maxOf(1, maxDest)
        }
    }

    private fun propagateWildPitchAdvances(
        panel: ScorerBaseRunningStep2Panel,
        runnerId: String,
        baseVal: Int,
    ) {
        val gameState = panel.controller.game.gameState
        val startBase =
            when (runnerId) {
                gameState.runnerFirstId?.toString() -> 1
                gameState.runnerSecondId?.toString() -> 2
                gameState.runnerThirdId?.toString() -> 3
                else -> 0
            }
        val otherRunners =
            listOfNotNull(
                gameState.runnerFirstId?.let { it.toString() to 1 },
                gameState.runnerSecondId?.let { it.toString() to 2 },
                gameState.runnerThirdId?.let { it.toString() to 3 },
            )
        otherRunners.forEach { (oId, oStart) ->
            if (oId != runnerId) {
                adjustRunnerDest(panel, oId, oStart, startBase, baseVal)
            }
        }
    }

    private fun renderWildPitchSubmitSection(
        panel: ScorerBaseRunningStep2Panel,
        parent: DIV,
        activeRunners: List<Pair<String, String>>,
    ) {
        parent.div(classes = "action-grid-3col margin-top-md") {
            listOf(
                ScoringEventType.WILD_PITCH to "Wild Pitch",
                ScoringEventType.PASSED_BALL to "Passed Ball",
                ScoringEventType.BALK to "Balk",
            ).forEach { (evType, evLabel) ->
                button(classes = "btn btn-action") {
                    +evLabel
                    onClickFunction = {
                        panel.submitWildPitchOrBalk(evType, evLabel, activeRunners)
                    }
                }
            }
        }
    }
}

private object StealPickoffStep2Ui {
    fun renderStealOrPickoff(
        panel: ScorerBaseRunningStep2Panel,
        parent: DIV,
        activeRunners: List<Pair<String, String>>,
    ) {
        if (activeRunners.isEmpty()) {
            parent.div(classes = "text-muted margin-bottom-md") {
                +"No runners currently on base to select."
            }
        } else {
            parent.div(classes = "font-bold margin-bottom-sm") {
                +"Select Runner:"
            }
            renderRunnerSelectionButtons(panel, parent, activeRunners)

            if (panel.selectedRunnerId != null) {
                if (panel.eventType == ScoringEventType.STOLEN_BASE) {
                    renderStolenBaseTargetSelection(panel, parent, activeRunners)
                } else {
                    renderDefenseThrowSequencePO(panel, parent, activeRunners)
                }
            }
        }
        renderCancelButton(panel, parent)
    }

    private fun renderRunnerSelectionButtons(
        panel: ScorerBaseRunningStep2Panel,
        parent: DIV,
        activeRunners: List<Pair<String, String>>,
    ) {
        parent.div(classes = "action-grid margin-bottom-md") {
            activeRunners.forEach { (rId, rLabel) ->
                val isSel = rId == panel.selectedRunnerId
                button(classes = if (isSel) "btn btn-primary" else "btn btn-secondary") {
                    +rLabel
                    onClickFunction = {
                        panel.selectedRunnerId = rId
                        panel.render()
                    }
                }
            }
        }
    }

    private fun renderCancelButton(panel: ScorerBaseRunningStep2Panel, parent: DIV) {
        parent.button(classes = "btn btn-secondary btn-full margin-top-md") {
            +"Cancel"
            onClickFunction = { panel.controller.renderActionGrid() }
        }
    }

    private fun renderStolenBaseTargetSelection(
        panel: ScorerBaseRunningStep2Panel,
        parent: DIV,
        activeRunners: List<Pair<String, String>>,
    ) {
        parent.div(classes = "font-bold margin-bottom-sm") {
            +"Select Target Stolen Base:"
        }
        parent.div(classes = "action-grid margin-bottom-md") {
            val gameState = panel.controller.game.gameState
            val currentBase =
                when (panel.selectedRunnerId) {
                    gameState.runnerFirstId?.toString() -> 1
                    gameState.runnerSecondId?.toString() -> 2
                    gameState.runnerThirdId?.toString() -> 3
                    else -> 1
                }
            panel.getStolenBaseOptions(currentBase).forEach { (targetBase, baseLabel) ->
                button(classes = "btn btn-action") {
                    +baseLabel
                    onClickFunction = { panel.performStolenBase(targetBase, activeRunners) }
                }
            }
        }
    }

    private fun renderDefenseThrowSequencePO(
        panel: ScorerBaseRunningStep2Panel,
        parent: DIV,
        activeRunners: List<Pair<String, String>>,
    ) {
        parent.div(classes = "font-bold margin-bottom-sm") {
            +"Defensive Throw Sequence"
        }
        val displaySeq = panel.getDisplaySequence()
        parent.div(classes = "scorer-sequence-box") {
            +"Sequence: $displaySeq"
        }
        renderThrowSequencePOButtons(panel, parent, activeRunners)
    }

    private fun renderThrowPOActionButtons(panel: ScorerBaseRunningStep2Panel, parent: DIV) {
        listOf(
            "U" to { panel.isUnassisted = !panel.isUnassisted },
            "⌫" to { if (panel.throwSequence.isNotEmpty()) panel.throwSequence.removeAt(panel.throwSequence.size - 1) },
            "Clear" to {
                panel.throwSequence.clear()
                panel.isUnassisted = false
            },
        ).forEach { (lbl, action) ->
            parent.button(classes = "btn btn-secondary") {
                +lbl
                onClickFunction = {
                    action()
                    panel.render()
                }
            }
        }
    }

    private fun renderThrowSequencePOButtons(
        panel: ScorerBaseRunningStep2Panel,
        parent: DIV,
        activeRunners: List<Pair<String, String>>,
    ) {
        parent.div(classes = "flex-gap-xs margin-bottom-md") {
            renderPositionButtons(panel, this)
            renderThrowPOActionButtons(panel, this)
        }
        parent.button(classes = "btn btn-action margin-top-md") {
            +"Submit Out"
            onClickFunction = { panel.submitPOOut(activeRunners) }
        }
    }

    private fun renderPositionButtons(panel: ScorerBaseRunningStep2Panel, parent: DIV) {
        val posLabels = listOf("1-P", "2-C", "3-1B", "4-2B", "5-3B", "6-SS", "7-LF", "8-CF", "9-RF")
        posLabels.forEachIndexed { idx, pLabel ->
            val posNum = idx + 1
            parent.button(classes = "btn btn-secondary") {
                +pLabel
                onClickFunction = {
                    if (panel.throwSequence.size < 6) {
                        panel.throwSequence.add(posNum)
                        panel.render()
                    }
                }
            }
        }
    }
}

fun GameScoringController.renderBaseRunningStep2(
    eventType: ScoringEventType,
    baseLabel: String,
) {
    val panel = ScorerBaseRunningStep2Panel(this, eventType, baseLabel)
    panel.render()
}
