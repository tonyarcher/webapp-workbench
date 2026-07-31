package com.baseball.ui.gametracking.scoring

import com.baseball.models.ScoringEventType
import kotlinx.browser.document
import org.w3c.dom.HTMLButtonElement

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
    internal val runnerAdvances = mutableMapOf<String, Int>()

    init {
        initializeAdvances()
    }

    private fun getBatterBase(): Int = when (eventType) {
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
            if (runnerAdvances[controller.game.gameState.runnerSecondId.toString()] != null || batterBase >= 3) {
                runnerAdvances[r3.toString()] = minOf(4, maxOf(currentLeading + 1, batterBase + 1))
            }
        }
    }

    fun render() {
        val gridEl = controller.actionGridWrapper ?: return
        gridEl.innerHTML = ""

        val card = document.createElement("div")
        card.className = "card padding-md"

        val title = document.createElement("h3")
        title.className = "text-accent-green font-bold margin-bottom-md"
        title.textContent = "Step 2: $baseLabel Details"
        card.appendChild(title)

        renderLocationGrid(card)
        renderCancelButton(card)

        gridEl.appendChild(card)
    }

    private fun renderLocationGrid(parent: org.w3c.dom.Element) {
        val locGrid = document.createElement("div")
        locGrid.className = "action-grid-3col margin-bottom-md"

        val locations = if (isHit) {
            listOf("Left Field", "Center Field", "Right Field", "Infield", "Down the Line", "Gap")
        } else {
            listOf(
                "Pitcher (1)", "Catcher (2)", "1st Base (3)", "2nd Base (4)", "3rd Base (5)",
                "Shortstop (6)", "Left Field (7)", "Center Field (8)", "Right Field (9)"
            )
        }

        locations.forEach { loc ->
            val btn = document.createElement("button") as HTMLButtonElement
            btn.className = "btn btn-action"
            btn.textContent = loc
            btn.addEventListener("click", { submitPlayWithLocation(loc) })
            locGrid.appendChild(btn)
        }

        val unspecBtn = document.createElement("button") as HTMLButtonElement
        unspecBtn.className = "btn btn-action"
        unspecBtn.textContent = "Unspecified Location"
        unspecBtn.addEventListener("click", { submitPlayWithLocation(null) })
        locGrid.appendChild(unspecBtn)

        parent.appendChild(locGrid)
    }

    private fun renderCancelButton(parent: org.w3c.dom.Element) {
        val cancelBtn = document.createElement("button") as HTMLButtonElement
        cancelBtn.className = "btn btn-secondary"
        cancelBtn.textContent = "Cancel"
        cancelBtn.addEventListener("click", { controller.renderActionGrid() })
        parent.appendChild(cancelBtn)
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
