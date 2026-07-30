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
import kotlinx.html.js.div
import kotlinx.html.js.onClickFunction
import kotlinx.html.span

class ScorerStep2Panel(
    internal val controller: GameScoringController,
    internal val eventType: ScoringEventType,
    internal val baseLabel: String,
    internal val isHit: Boolean,
) {
    internal var hasError = false
    internal var hasDoublePlay = false
    internal val throwSequence = mutableListOf<Int>()
    internal var isUnassisted = false
    internal var hrType = "Over the Fence"
    internal val runnerAdvances = mutableMapOf<String, Int>()

    init {
        initializeAdvances()
    }

    private fun getBatterBase(): Int =
        when (eventType) {
            ScoringEventType.SINGLE,
            ScoringEventType.WALK,
            ScoringEventType.HIT_BY_PITCH,
            ScoringEventType.ERROR,
            ScoringEventType.FIELDER_CHOICE -> 1

            ScoringEventType.DOUBLE -> 2
            ScoringEventType.TRIPLE -> 3
            ScoringEventType.HOME_RUN -> 4
            else -> 0
        }

    internal fun initializeAdvances() {
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
            if (runnerAdvances[
                    controller.game.gameState.runnerSecondId
                        .toString(),
                ] != null ||
                batterBase >= 3
            ) {
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
                css {
                    marginBottom = 1.rem
                    color = Color("var(--accent-green)")
                    fontSize = 1.2.rem
                }
            }
            ScorerStep2OptionsUi.renderOptionsBar(this@ScorerStep2Panel, this)
            if (eventType == ScoringEventType.HOME_RUN) {
                ScorerStep2OptionsUi.renderHomeRunOptions(this@ScorerStep2Panel, this)
            }
            ScorerStep2RunnerAdvancementUi.renderRunnersAdvancement(this@ScorerStep2Panel, this)
            ScorerStep2DefensePlayUi.renderThrowSequenceSection(this@ScorerStep2Panel, this)
            ScorerStep2FielderGridUi.renderFielderGridSection(this@ScorerStep2Panel, this)
            ScorerStep2DefensePlayUi.renderFooter(this@ScorerStep2Panel, this)
        }
    }

    internal fun submitPlayWithLocation(loc: String?) {
        val seqStr = buildSeqString(throwSequence, isUnassisted)
        val detailParams = PlayDetailParams(
            baseLabel = baseLabel,
            loc = loc,
            seqStr = seqStr,
            hasRunnerOut = runnerAdvances.values.contains(0),
            eventType = eventType,
            hasDoublePlay = hasDoublePlay,
            hasError = hasError,
        )
        val detail = buildPlayDetailString(detailParams)
        controller.triggerScoringEvent(
            eventType,
            detail,
            hasDoublePlay,
            hasError,
            runnerAdvances.takeIf { it.isNotEmpty() },
        )
    }
}

private object ScorerStep2OptionsUi {
    fun renderOptionsBar(panel: ScorerStep2Panel, parent: DIV) {
        parent.div {
            css {
                display = Display.flex
                gap = 0.5.rem
                marginBottom = 1.rem
            }
            button(classes = if (panel.hasError) "btn btn-danger" else "btn btn-secondary") {
                +(if (panel.hasError) "Error Active" else "+ Add Error")
                onClickFunction = {
                    panel.hasError = !panel.hasError
                    panel.render()
                }
            }
            if (!panel.isHit) {
                renderDoublePlayButton(panel, this)
            }
        }
    }

    private fun renderDoublePlayButton(panel: ScorerStep2Panel, parent: DIV) {
        parent.button(classes = if (panel.hasDoublePlay) "btn btn-primary" else "btn btn-secondary") {
            +(if (panel.hasDoublePlay) "Double Play Active" else "+ Add Double Play")
            onClickFunction = {
                panel.hasDoublePlay = !panel.hasDoublePlay
                if (panel.hasDoublePlay) {
                    val gameState = panel.controller.game.gameState
                    val leadRunnerId = gameState.runnerThirdId
                        ?: gameState.runnerSecondId
                        ?: gameState.runnerFirstId
                    if (leadRunnerId != null) {
                        panel.runnerAdvances[leadRunnerId.toString()] = 0
                    }
                } else {
                    panel.runnerAdvances.clear()
                    panel.initializeAdvances()
                }
                panel.render()
            }
        }
    }

    fun renderHomeRunOptions(panel: ScorerStep2Panel, parent: DIV) {
        parent.div {
            +"Home Run Type"
            css {
                fontWeight = FontWeight.bold
                fontSize = 0.9.rem
                color = Color("var(--text-secondary)")
                marginBottom = 0.5.rem
            }
        }
        parent.div {
            css {
                display = Display.flex
                gap = 0.5.rem
                marginBottom = 1.rem
            }
            listOf("Over the Fence", "Inside the Park").forEach { opt ->
                val active = opt == panel.hrType
                button(classes = if (active) "btn btn-primary" else "btn btn-secondary") {
                    +opt
                    css { put("flex", "1") }
                    onClickFunction = {
                        panel.hrType = opt
                        panel.render()
                    }
                }
            }
        }
    }
}

private object ScorerStep2RunnerAdvancementUi {
    fun renderRunnersAdvancement(panel: ScorerStep2Panel, parent: DIV) {
        val runnersList = getActiveRunnersList(panel)
        if (runnersList.isNotEmpty()) {
            parent.div {
                +"Runner Base Advancement (Optional)"
                css {
                    fontWeight = FontWeight.bold
                    fontSize = 0.9.rem
                    color = Color("var(--text-secondary)")
                    marginBottom = 0.5.rem
                }
            }
            runnersList.forEach { (runnerId, label) ->
                renderSingleRunnerAdvancement(panel, parent, runnerId, label)
            }
        }
    }

    private fun getActiveRunnersList(panel: ScorerStep2Panel): List<Pair<Long, String>> {
        val gameState = panel.controller.game.gameState
        val r1 = gameState.runnerFirstId to gameState.runnerFirstName
        val r2 = gameState.runnerSecondId to gameState.runnerSecondName
        val r3 = gameState.runnerThirdId to gameState.runnerThirdName

        val activeRunners = listOfNotNull(
            r1.first?.let { it to ("Runner on 1B: " + r1.second) },
            r2.first?.let { it to ("Runner on 2B: " + r2.second) },
            r3.first?.let { it to ("Runner on 3B: " + r3.second) },
        )
        return if (panel.hasError && gameState.currentBatterId != null) {
            val batterId = gameState.currentBatterId!!
            val batterLabel = "Batter: ${gameState.currentBatterName}"
            activeRunners + (batterId to batterLabel)
        } else {
            activeRunners
        }
    }

    private fun renderSingleRunnerAdvancement(
        panel: ScorerStep2Panel,
        parent: DIV,
        runnerId: Long,
        label: String,
    ) {
        parent.div {
            css {
                display = Display.flex
                alignItems = Align.center
                justifyContent = JustifyContent.spaceBetween
                marginBottom = 0.5.rem
                gap = 0.5.rem
                background = "rgba(255, 255, 255, 0.03)"
                padding = Padding(0.4.rem)
                borderRadius = 4.px
            }
            span {
                +label
                css {
                    fontSize = 0.85.rem
                    put("flex", "1")
                }
            }
            renderAdvOptionGroup(panel, this, runnerId)
        }
    }

    private fun renderAdvOptionGroup(panel: ScorerStep2Panel, parent: DIV, runnerId: Long) {
        parent.div {
            css {
                display = Display.flex
                gap = 0.2.rem
            }
            val options =
                if (runnerId == panel.controller.game.gameState.currentBatterId) {
                    listOf(0 to "Out", 1 to "1B", 2 to "2B", 3 to "3B", 4 to "HR")
                } else {
                    listOf(0 to "Out", 2 to "2B", 3 to "3B", 4 to "Score")
                }
            options.forEach { (baseVal, baseLabel) ->
                renderAdvButton(panel, this, runnerId, baseVal, baseLabel)
            }
        }
    }

    private fun renderAdvButton(
        panel: ScorerStep2Panel,
        parent: DIV,
        runnerId: Long,
        baseVal: Int,
        baseLabel: String,
    ) {
        val currentDest = panel.runnerAdvances[runnerId.toString()]
        val isSelected = currentDest == baseVal
        val btnClass =
            if (isSelected) {
                if (baseVal == 0) "btn btn-danger" else "btn btn-primary"
            } else {
                "btn btn-secondary"
            }
        parent.button(classes = btnClass) {
            +baseLabel
            css {
                padding = Padding(0.2.rem, 0.4.rem)
                fontSize = 0.75.rem
            }
            onClickFunction = {
                if (isSelected) {
                    panel.runnerAdvances.remove(runnerId.toString())
                } else {
                    panel.runnerAdvances[runnerId.toString()] = baseVal
                    propagateForcedAdvances(panel, runnerId, baseVal)
                }
                panel.render()
            }
        }
    }

    private fun propagateForcedAdvances(panel: ScorerStep2Panel, runnerId: Long, baseVal: Int) {
        if (baseVal <= 0) return
        val gameState = panel.controller.game.gameState
        val startBase = when (runnerId) {
            gameState.runnerFirstId -> 1
            gameState.runnerSecondId -> 2
            gameState.runnerThirdId -> 3
            else -> 0
        }
        val otherRunners = listOfNotNull(
            gameState.runnerFirstId?.let { it.toString() to 1 },
            gameState.runnerSecondId?.let { it.toString() to 2 },
            gameState.runnerThirdId?.let { it.toString() to 3 },
            gameState.currentBatterId?.let { it.toString() to 0 },
        )
        otherRunners.forEach { (oId, oStart) ->
            if (oId != runnerId.toString()) {
                adjustRunnerDest(panel, oId, oStart, startBase, baseVal)
            }
        }
    }

    private fun adjustRunnerDest(
        panel: ScorerStep2Panel,
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
}

private object ScorerStep2DefensePlayUi {
    fun renderThrowSequenceSection(panel: ScorerStep2Panel, parent: DIV) {
        val showThrowBuilder =
            panel.eventType in listOf(ScoringEventType.GROUNDOUT, ScoringEventType.FIELDER_CHOICE) ||
                    panel.hasDoublePlay ||
                    panel.runnerAdvances.values.contains(0)
        if (!showThrowBuilder) return
        renderThrowSequenceHeader(panel, parent)
        renderThrowBuilderButtons(panel, parent)
    }

    private fun renderThrowSequenceHeader(panel: ScorerStep2Panel, parent: DIV) {
        parent.div {
            +"Defensive Play / Throw Sequence"
            css {
                fontWeight = FontWeight.bold
                fontSize = 0.9.rem
                color = Color("var(--text-secondary)")
                marginTop = 1.rem
                marginBottom = 0.5.rem
            }
        }
        val displaySeq = getDisplaySequence(panel)
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
    }

    private fun getDisplaySequence(panel: ScorerStep2Panel): String = buildString {
        if (panel.throwSequence.isEmpty()) {
            append("No throws (Unassisted/Direct)")
        } else {
            append(panel.throwSequence.joinToString("-"))
            if (panel.isUnassisted) append("U")
        }
    }

    private fun renderThrowBuilderButtons(panel: ScorerStep2Panel, parent: DIV) {
        parent.div {
            css {
                display = Display.flex
                gap = 4.px
                put("flex-wrap", "wrap")
                marginBottom = 1.rem
            }
            renderPosBuilderButtons(panel, this)
            renderControlBuilderButtons(panel, this)
        }
    }

    private fun renderPosBuilderButtons(panel: ScorerStep2Panel, parent: DIV) {
        val posLabels = listOf("1-P", "2-C", "3-1B", "4-2B", "5-3B", "6-SS", "7-LF", "8-CF", "9-RF")
        posLabels.forEachIndexed { idx, label ->
            val posNum = idx + 1
            parent.button(classes = "btn btn-secondary") {
                +label
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

    private fun renderControlBuilderButtons(panel: ScorerStep2Panel, parent: DIV) {
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

    fun renderFooter(panel: ScorerStep2Panel, parent: DIV) {
        parent.div {
            css {
                display = Display.flex
                gap = 1.rem
            }
            button(classes = "btn btn-secondary") {
                +"Cancel"
                css { put("flex", "1") }
                onClickFunction = { panel.controller.renderActionGrid() }
            }
        }
    }
}

private object ScorerStep2FielderGridUi {
    fun renderFielderGridSection(panel: ScorerStep2Panel, parent: DIV) {
        if (panel.eventType == ScoringEventType.HOME_RUN && panel.hrType == "Over the Fence") {
            renderFenceHrCompleteButton(panel, parent)
        } else {
            parent.div {
                +"Select Hit/Out Fielder to Complete Play"
                css {
                    fontWeight = FontWeight.bold
                    fontSize = 0.9.rem
                    color = Color("var(--text-secondary)")
                    marginTop = 1.rem
                    marginBottom = 0.5.rem
                }
            }
            renderFielderButtons(panel, parent)
        }
    }

    private fun renderFenceHrCompleteButton(panel: ScorerStep2Panel, parent: DIV) {
        parent.div {
            css {
                marginTop = 1.rem
                marginBottom = 1.rem
            }
            button(classes = "btn btn-primary") {
                +"Complete Play (Home Run)"
                css {
                    width = 100.pct
                    padding = Padding(0.75.rem)
                }
                onClickFunction = {
                    val detail = "Home Run (Over the Fence)" + if (panel.hasError) " (with Error)" else ""
                    panel.controller.triggerScoringEvent(
                        panel.eventType,
                        detail,
                        false,
                        panel.hasError,
                        panel.runnerAdvances.takeIf { it.isNotEmpty() }
                    )
                }
            }
        }
    }

    private fun renderFielderButtons(panel: ScorerStep2Panel, parent: DIV) {
        parent.div(classes = "action-grid") {
            css { marginBottom = 1.rem }
            val locations = getFielderLocations(panel.isHit)
            renderLocationButtons(panel, this, locations)
            button(classes = "btn btn-action") {
                +"Unspecified Location"
                css { background = "rgba(255, 255, 255, 0.1)" }
                onClickFunction = { panel.submitPlayWithLocation(null) }
            }
        }
    }

    private fun renderLocationButtons(panel: ScorerStep2Panel, parent: DIV, locations: List<String>) {
        locations.forEach { loc ->
            parent.button(classes = "btn btn-action") {
                +loc
                onClickFunction = { panel.submitPlayWithLocation(loc) }
            }
        }
    }
}

private fun getFielderLocations(isHit: Boolean): List<String> =
    if (isHit) {
        listOf("Left Field", "Center Field", "Right Field", "Infield", "Down the Line", "Gap")
    } else {
        listOf(
            "Pitcher (1)",
            "Catcher (2)",
            "1st Base (3)",
            "2nd Base (4)",
            "3rd Base (5)",
            "Shortstop (6)",
            "Left Field (7)",
            "Center Field (8)",
            "Right Field (9)",
        )
    }

private data class PlayDetailParams(
    val baseLabel: String,
    val loc: String?,
    val seqStr: String?,
    val hasRunnerOut: Boolean,
    val eventType: ScoringEventType,
    val hasDoublePlay: Boolean,
    val hasError: Boolean,
)

private fun buildPlayDetailString(params: PlayDetailParams): String = buildString {
    val mainNotation = formatMainPlayNotation(
        params.baseLabel,
        params.loc,
        params.seqStr,
        params.hasRunnerOut,
        params.eventType,
    )
    append(mainNotation)
    if (params.hasDoublePlay) append(" (Double Play)")
    if (params.hasError) append(" (with Error)")
}

private fun formatMainPlayNotation(
    baseLabel: String,
    loc: String?,
    seqStr: String?,
    hasRunnerOut: Boolean,
    eventType: ScoringEventType,
): String {
    val locSuffix = if (loc != null) " to $loc" else ""
    if (seqStr != null) {
        return if (hasRunnerOut) "$baseLabel$locSuffix (Runner Out: $seqStr)" else "$baseLabel: $seqStr"
    }
    return if (eventType == ScoringEventType.HOME_RUN) {
        "Inside the Park Home Run to " + (loc ?: "Unspecified")
    } else {
        "$baseLabel$locSuffix"
    }
}

private fun buildSeqString(throwSequence: List<Int>, isUnassisted: Boolean): String? =
    if (throwSequence.isNotEmpty()) {
        val s = throwSequence.joinToString("-")
        if (isUnassisted) "${s}U" else s
    } else if (isUnassisted) {
        "3U"
    } else {
        null
    }

fun GameScoringController.renderStep2(
    eventType: ScoringEventType,
    baseLabel: String,
    isHit: Boolean,
) {
    val panel = ScorerStep2Panel(this, eventType, baseLabel, isHit)
    panel.render()
}
