package com.baseball.ui.gametracking.scorebook

import com.baseball.models.PlayEvent
import com.baseball.models.Player
import com.baseball.models.ScoringEventType

data class RunnerProgression(
    val maxBase: Int,
    val outAtBase: Int?,
    val outDetail: String?,
)

private data class RunnerStepResult(
    val maxBase: Int,
    val currentBase: Int,
    val outBase: Int?,
    val outDetail: String?,
    val shouldBreak: Boolean
)

class ScorecardParser(
    private val teamEvents: List<PlayEvent>,
    private val localAwayRoster: List<Player>,
    private val localHomeRoster: List<Player>,
    private val maxInning: Int,
) {
    val playAdvancements = mutableMapOf<PlayEvent, Int>()
    val playOutNumbers = mutableMapOf<PlayEvent, Int>()
    val playProgressions = mutableMapOf<PlayEvent, RunnerProgression>()

    init {
        parseAllEvents()
    }

    private fun parseAllEvents() {
        val baseRunners = mutableMapOf<String, Int>()
        for (inn in 1..maxInning) {
            val innEvents = teamEvents.filter { it.inning == inn }
            baseRunners.clear()
            processInningEvents(innEvents, baseRunners)
            innEvents.forEachIndexed { evIdx, ev ->
                if (ScorecardAdvancementCalculator.isResolvingEvent(ev.eventType)) {
                    playProgressions[ev] = computeRunnerProgression(ev, evIdx, innEvents)
                }
            }
        }
    }

    private fun processInningEvents(innEvents: List<PlayEvent>, baseRunners: MutableMap<String, Int>) {
        var currentOuts = 0
        innEvents.forEach { ev ->
            val isOut = ScorecardNotationFormatter.isOutEvent(ev.eventType)
            var finalBase = ScorecardAdvancementCalculator.getInitialBaseForEvent(ev.eventType)
            currentOuts = processEventOutsAndRunners(ev, finalBase, currentOuts, baseRunners, innEvents)
            if (ev.runsScoredOnPlay > 0) {
                finalBase = ScorecardAdvancementCalculator.processRunsScoredOnPlay(ev, finalBase, baseRunners)
            }
            playAdvancements[ev] = baseRunners[ev.batterName] ?: finalBase
        }
    }

    private fun processEventOutsAndRunners(
        ev: PlayEvent,
        finalBase: Int,
        initialOuts: Int,
        baseRunners: MutableMap<String, Int>,
        innEvents: List<PlayEvent>
    ): Int {
        var currentOuts = initialOuts
        val isOut = ScorecardNotationFormatter.isOutEvent(ev.eventType)
        val isDoublePlay = ev.description.contains("(Double Play)")
        if (isDoublePlay) {
            val subAdvances = ScorecardAdvancementCalculator.parseRunnerAdvances(ev.description)
            val outRunnerEntry = baseRunners.entries.find { rEntry ->
                val pId = (localAwayRoster + localHomeRoster).find { it.name == rEntry.key }?.id
                pId != null && subAdvances[pId.toString()] == 0
            }
            if (outRunnerEntry != null) {
                baseRunners.remove(outRunnerEntry.key)
                val runnerEv = innEvents.takeWhile { it != ev }.findLast { it.batterName == outRunnerEntry.key }
                if (runnerEv != null) playOutNumbers[runnerEv] = ++currentOuts else currentOuts++
            } else {
                currentOuts++
            }
            currentOuts++
            playOutNumbers[ev] = currentOuts
        } else if (isOut) {
            currentOuts++
            playOutNumbers[ev] = currentOuts
        } else {
            baseRunners[ev.batterName] = finalBase
        }
        return currentOuts
    }

    private fun computeRunnerProgression(ev: PlayEvent, evIdx: Int, innEvents: List<PlayEvent>): RunnerProgression {
        var maxB = playAdvancements[ev] ?: 0
        var outB: Int? = null
        var outDet: String? = null
        val isOut = ScorecardNotationFormatter.isOutEvent(ev.eventType)
        if (isOut) {
            outB = 1
            outDet = ScorecardNotationFormatter.getScorebookNotation(ev)
        } else if (maxB > 0) {
            val (calculatedMaxB, calculatedOutB, calculatedOutDet) = trackSubsequentAdvances(ev, evIdx, innEvents, maxB)
            maxB = calculatedMaxB
            outB = calculatedOutB
            outDet = calculatedOutDet
        }
        return RunnerProgression(maxB, outB, outDet)
    }

    private fun trackSubsequentAdvances(
        ev: PlayEvent,
        evIdx: Int,
        innEvents: List<PlayEvent>,
        initialMaxB: Int
    ): Triple<Int, Int?, String?> {
        var maxB = initialMaxB
        var outB: Int? = null
        var outDet: String? = null
        val rName = ev.batterName
        val pId = (localAwayRoster + localHomeRoster).find { it.name == rName }?.id ?: return Triple(maxB, outB, outDet)
        var currentB = maxB
        for (i in (evIdx + 1) until innEvents.size) {
            val stepResult = ScorecardAdvancementCalculator.processSubsequentEvent(
                innEvents[i], pId.toString(), maxB, currentB
            )
            maxB = stepResult.maxBase
            currentB = stepResult.currentBase
            if (stepResult.outBase != null) {
                outB = stepResult.outBase
                outDet = stepResult.outDetail
            }
            if (stepResult.shouldBreak) break
        }
        return Triple(maxB, outB, outDet)
    }
}

internal fun getScorebookNotation(ev: PlayEvent): String =
    ScorecardNotationFormatter.getScorebookNotation(ev)

fun getHitLocationNumber(desc: String): String? =
    ScorecardNotationFormatter.getHitLocationNumber(desc)

internal fun isOutEvent(type: ScoringEventType): Boolean =
    ScorecardNotationFormatter.isOutEvent(type)

private object ScorecardAdvancementCalculator {
    fun processRunsScoredOnPlay(
        ev: PlayEvent,
        initialFinalBase: Int,
        baseRunners: MutableMap<String, Int>
    ): Int {
        var finalBase = initialFinalBase
        var runsToScore = ev.runsScoredOnPlay
        if (ev.eventType == ScoringEventType.HOME_RUN) {
            finalBase = 4
            runsToScore--
        }
        val activeRunners = baseRunners.entries
            .filter { it.key != ev.batterName && it.value < 4 }
            .sortedByDescending { it.value }
        for (r in activeRunners) {
            if (runsToScore > 0) {
                baseRunners[r.key] = 4
                runsToScore--
            }
        }
        if (runsToScore > 0 && finalBase < 4) finalBase = 4
        return finalBase
    }

    fun isResolvingEvent(eventType: ScoringEventType): Boolean = eventType in listOf(
        ScoringEventType.SINGLE, ScoringEventType.DOUBLE, ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN,
        ScoringEventType.WALK, ScoringEventType.HIT_BY_PITCH, ScoringEventType.STRIKEOUT, ScoringEventType.GROUNDOUT,
        ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT, ScoringEventType.ERROR,
        ScoringEventType.FIELDER_CHOICE, ScoringEventType.SACRIFICE_FLY
    )

    fun processSubsequentEvent(
        subEv: PlayEvent,
        pIdStr: String,
        initialMaxB: Int,
        initialCurrentB: Int
    ): RunnerStepResult {
        var maxB = initialMaxB
        var currentB = initialCurrentB
        var outB: Int? = null
        var outDet: String? = null
        var shouldBreak = false
        val subAdvances = parseRunnerAdvances(subEv.description)
        val targetBase = subAdvances[pIdStr]
        if (targetBase != null) {
            if (targetBase > 0) {
                currentB = targetBase
                maxB = maxOf(maxB, targetBase)
            } else if (targetBase == 0) {
                outB = currentB + 1
                outDet = ScorecardNotationFormatter.getOutDetail(subEv)
                shouldBreak = true
            }
        } else if (subEv.runsScoredOnPlay > 0 &&
            subAdvances.isEmpty() &&
            subEv.eventType == ScoringEventType.HOME_RUN
        ) {
            maxB = 4
            currentB = 4
        }
        return RunnerStepResult(maxB, currentB, outB, outDet, shouldBreak)
    }

    fun parseRunnerAdvances(description: String): Map<String, Int> {
        val marker = " | Adv: "
        if (!description.contains(marker)) return emptyMap()
        val parts = description.substringAfter(marker).split(",")
        val map = mutableMapOf<String, Int>()
        parts.forEach { part ->
            val pair = part.split("->")
            if (pair.size == 2) {
                val pId = pair[0]
                val base = pair[1].toIntOrNull()
                if (base != null) {
                    map[pId] = base
                }
            }
        }
        return map
    }

    fun getInitialBaseForEvent(eventType: ScoringEventType): Int = when (eventType) {
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
}

private object ScorecardNotationFormatter {

    fun getOutDetail(subEv: PlayEvent): String =
        when (subEv.eventType) {
            ScoringEventType.CAUGHT_STEALING -> getScorebookNotation(subEv)
            ScoringEventType.PICKED_OFF -> getScorebookNotation(subEv)
            else -> {
                val match = Regex("Runner Out: (\\d+(?:-\\d+)*U?)").find(subEv.description)
                val fullSeq = match?.groupValues?.get(1)
                if (fullSeq != null) {
                    val parts = fullSeq.substringBefore("U").split("-")
                    if (parts.size >= 3) {
                        "${parts[0]}-${parts[1]}"
                    } else {
                        fullSeq
                    }
                } else {
                    "Out"
                }
            }
        }

    fun getScorebookNotation(ev: PlayEvent): String {
        val suffix = if (ev.description.contains("(Double Play)") || ev.description.contains("(DP)")) " DP" else ""
        val type = ev.eventType
        val hitNotation = getHitNotation(ev)
        if (hitNotation.isNotEmpty()) return hitNotation
        return when (type) {
            ScoringEventType.WALK -> "BB"
            ScoringEventType.HIT_BY_PITCH -> "HBP"
            ScoringEventType.STRIKEOUT -> "K$suffix"
            ScoringEventType.SACRIFICE_FLY -> "SF"
            ScoringEventType.ERROR -> "E"
            ScoringEventType.GROUNDOUT,
            ScoringEventType.FLYOUT,
            ScoringEventType.LINE_OUT,
            ScoringEventType.POP_OUT,
            ScoringEventType.FIELDER_CHOICE -> getOutScorebookNotation(ev, suffix)

            else -> getBaseRunningNotation(ev)
        }
    }

    private fun getHitNotation(ev: PlayEvent): String {
        val loc = getHitLocationNumber(ev.description) ?: ""
        return when (ev.eventType) {
            ScoringEventType.SINGLE -> "1B$loc"
            ScoringEventType.DOUBLE -> "2B$loc"
            ScoringEventType.TRIPLE -> "3B$loc"
            ScoringEventType.HOME_RUN -> "HR$loc"
            else -> ""
        }
    }

    fun getBaseRunningNotation(ev: PlayEvent): String = when (ev.eventType) {
        ScoringEventType.STOLEN_BASE -> when {
            ev.description.contains("to 3B") -> "SB3"
            ev.description.contains("to Home") -> "SBH"
            else -> "SB"
        }

        ScoringEventType.CAUGHT_STEALING -> {
            val match = Regex("Caught Stealing: .* (\\d+(?:-\\d+)*U?)\\)").find(ev.description)
            if (match != null) "CS ${match.groupValues[1]}" else "CS"
        }

        ScoringEventType.PICKED_OFF -> {
            val match = Regex("Picked Off: .* (\\d+(?:-\\d+)*U?)\\)").find(ev.description)
            if (match != null) "PO ${match.groupValues[1]}" else "PO"
        }

        ScoringEventType.WILD_PITCH -> "WP"
        ScoringEventType.PASSED_BALL -> "PB"
        ScoringEventType.BALK -> "BK"
        else -> ""
    }

    fun getOutScorebookNotation(ev: PlayEvent, suffix: String): String {
        val desc = ev.description
        return when (ev.eventType) {
            ScoringEventType.GROUNDOUT -> formatGroundoutNotation(desc, suffix)
            ScoringEventType.FLYOUT -> "F${Regex("to .* \\((\\d)\\)").find(desc)?.groupValues?.get(1) ?: "8"}$suffix"
            ScoringEventType.LINE_OUT -> "L${Regex("to .* \\((\\d)\\)").find(desc)?.groupValues?.get(1) ?: "6"}$suffix"
            ScoringEventType.POP_OUT -> "P${Regex("to .* \\((\\d)\\)").find(desc)?.groupValues?.get(1) ?: "4"}$suffix"
            ScoringEventType.FIELDER_CHOICE -> formatFielderChoiceNotation(desc, suffix)
            else -> ""
        }
    }

    fun formatGroundoutNotation(desc: String, suffix: String): String {
        val runnerOut = Regex("Runner Out: (\\d+(?:-\\d+)*U?)").find(desc)
        val seq = Regex("Groundout: (\\d+(?:-\\d+)*U?)").find(desc)
        val base = when {
            runnerOut != null -> runnerOut.groupValues[1]
            seq != null -> seq.groupValues[1]
            else -> "${Regex("to .* \\((\\d)\\)").find(desc)?.groupValues?.get(1) ?: "3"}-3"
        }
        return "$base$suffix"
    }

    fun formatFielderChoiceNotation(desc: String, suffix: String): String {
        val runnerOut = Regex("Runner Out: (\\d+(?:-\\d+)*U?)").find(desc)
        val seq = Regex("Fielder's Choice: (\\d+(?:-\\d+)*U?)").find(desc)
        val base = when {
            runnerOut != null -> runnerOut.groupValues[1]
            seq != null -> seq.groupValues[1]
            else -> "FC"
        }
        return "$base$suffix"
    }

    fun getHitLocationNumber(desc: String): String? {
        val locations = listOf(
            "Left Field" to "7",
            "Center Field" to "8",
            "Right Field" to "9",
            "Shortstop" to "6",
            "2nd Base" to "4",
            "Second Base" to "4",
            "3rd Base" to "5",
            "Third Base" to "5",
            "1st Base" to "3",
            "First Base" to "3",
            "Pitcher" to "1",
            "Catcher" to "2",
            "Infield" to "IF"
        )
        return locations.firstOrNull { desc.contains(it.first) }?.second
    }

    fun isOutEvent(type: ScoringEventType): Boolean =
        type in listOf(
            ScoringEventType.STRIKEOUT,
            ScoringEventType.GROUNDOUT,
            ScoringEventType.FLYOUT,
            ScoringEventType.LINE_OUT,
            ScoringEventType.POP_OUT,
            ScoringEventType.SACRIFICE_FLY,
        )

    fun getInitialBaseForEvent(eventType: ScoringEventType): Int = when (eventType) {
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
}
