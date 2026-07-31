package com.baseball.ui.gametracking.scoring

import com.baseball.models.ScoringEventType
import com.baseball.ui.core.css
import kotlinx.css.Align
import kotlinx.css.Border
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.FontWeight
import kotlinx.css.JustifyContent
import kotlinx.css.Padding
import kotlinx.css.TextAlign
import kotlinx.css.alignItems
import kotlinx.css.background
import kotlinx.css.border
import kotlinx.css.borderRadius
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.fontSize
import kotlinx.css.fontWeight
import kotlinx.css.gap
import kotlinx.css.justifyContent
import kotlinx.css.marginBottom
import kotlinx.css.marginTop
import kotlinx.css.padding
import kotlinx.css.pct
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.textAlign
import kotlinx.css.width
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
            h3 {
                +"Base Running: $baseLabel"
                css {
                    marginBottom = 1.rem
                    color = Color("var(--accent-green)")
                    fontSize = 1.2.rem
                }
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
            parent.div {
                +"No runners currently on base."
                css {
                    marginBottom = 1.5.rem
                    color = Color("#777")
                }
            }
        } else {
            parent.div {
                +"Select Runner Base Advancements:"
                css {
                    fontWeight = FontWeight.bold
                    marginBottom = 0.5.rem
                }
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
        parent.div {
            css {
                display = Display.flex
                alignItems = Align.center
                justifyContent = JustifyContent.spaceBetween
                marginBottom = 0.5.rem
                background = "rgba(255, 255, 255, 0.03)"
                padding = Padding(0.4.rem)
                borderRadius = 4.px
            }
            span {
                +rLabel
                css { fontSize = 0.85.rem }
            }
            div {
                css {
                    display = Display.flex
                    gap = 0.2.rem
                }
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
            css {
                padding = Padding(0.2.rem, 0.4.rem)
                fontSize = 0.75.rem
            }
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
        parent.div(classes = "action-grid") {
            css {
                put("grid-template-columns", "repeat(3, 1fr)")
                gap = 0.5.rem
                marginTop = 1.5.rem
            }
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
            parent.div {
                +"No runners currently on base to select."
                css {
                    marginBottom = 1.5.rem
                    color = Color("#777")
                }
            }
        } else {
            parent.div {
                +"Select Runner:"
                css {
                    fontWeight = FontWeight.bold
                    marginBottom = 0.5.rem
                }
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
        parent.div(classes = "action-grid") {
            css { marginBottom = 1.rem }
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
        parent.button(classes = "btn btn-secondary") {
            +"Cancel"
            css {
                marginTop = 1.rem
                width = 100.pct
            }
            onClickFunction = { panel.controller.renderActionGrid() }
        }
    }

    private fun renderStolenBaseTargetSelection(
        panel: ScorerBaseRunningStep2Panel,
        parent: DIV,
        activeRunners: List<Pair<String, String>>,
    ) {
        parent.div {
            +"Select Target Stolen Base:"
            css {
                fontWeight = FontWeight.bold
                marginBottom = 0.5.rem
            }
        }
        parent.div(classes = "action-grid") {
            css { marginBottom = 1.rem }
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
        parent.div {
            +"Defensive Throw Sequence"
            css {
                fontWeight = FontWeight.bold
                marginBottom = 0.5.rem
            }
        }
        val displaySeq = panel.getDisplaySequence()
        parent.div {
            +"Sequence: $displaySeq"
            css {
                padding = Padding(0.5.rem)
                background = "rgba(255, 255, 255, 0.05)"
                border = Border(1.px, BorderStyle.solid, Color("#5a544a"))
                borderRadius = 4.px
                fontWeight = FontWeight.bold
                textAlign = TextAlign.center
                marginBottom = 0.5.rem
            }
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
                css {
                    padding = Padding(4.px, 8.px)
                    fontSize = 0.75.rem
                }
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
        parent.div {
            css {
                display = Display.flex
                gap = 4.px
                put("flex-wrap", "wrap")
                marginBottom = 1.rem
            }
            renderPositionButtons(panel, this)
            renderThrowPOActionButtons(panel, this)
        }
        parent.button(classes = "btn btn-action") {
            +"Submit Out"
            css { marginTop = 1.rem }
            onClickFunction = { panel.submitPOOut(activeRunners) }
        }
    }

    private fun renderPositionButtons(panel: ScorerBaseRunningStep2Panel, parent: DIV) {
        val posLabels = listOf("1-P", "2-C", "3-1B", "4-2B", "5-3B", "6-SS", "7-LF", "8-CF", "9-RF")
        posLabels.forEachIndexed { idx, pLabel ->
            val posNum = idx + 1
            parent.button(classes = "btn btn-secondary") {
                +pLabel
                css {
                    padding = Padding(4.px, 8.px)
                    fontSize = 0.75.rem
                }
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
