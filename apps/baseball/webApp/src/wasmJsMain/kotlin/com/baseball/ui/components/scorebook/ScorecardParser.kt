package com.baseball.ui.components.scorebook

import com.baseball.models.*
import com.baseball.ui.*

data class RunnerProgression(
    val maxBase: Int,
    val outAtBase: Int?,
    val outDetail: String?
)

class ScorecardParser(
    private val teamEvents: List<PlayEvent>,
    private val localAwayRoster: List<Player>,
    private val localHomeRoster: List<Player>,
    private val maxInning: Int
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
            var currentOuts = 0

            innEvents.forEach { ev ->
                val isOut = ev.eventType in listOf(
                    ScoringEventType.STRIKEOUT, ScoringEventType.GROUNDOUT,
                    ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT,
                    ScoringEventType.POP_OUT, ScoringEventType.SACRIFICE_FLY
                )

                var finalBase = 0
                when (ev.eventType) {
                    ScoringEventType.SINGLE, ScoringEventType.WALK, ScoringEventType.HIT_BY_PITCH, ScoringEventType.ERROR, ScoringEventType.FIELDER_CHOICE -> {
                        finalBase = 1
                    }
                    ScoringEventType.DOUBLE -> {
                        finalBase = 2
                    }
                    ScoringEventType.TRIPLE -> {
                        finalBase = 3
                    }
                    ScoringEventType.HOME_RUN -> {
                        finalBase = 4
                    }
                    else -> {}
                }

                val isDoublePlay = ev.description.contains("(Double Play)")
                if (isDoublePlay) {
                    val subAdvances = parseRunnerAdvances(ev.description)
                    val outRunnerEntry = baseRunners.entries.find { rEntry ->
                        val pId = (localAwayRoster + localHomeRoster).find { it.name == rEntry.key }?.id
                        pId != null && subAdvances[pId.toString()] == 0
                    }

                    if (outRunnerEntry != null) {
                        val outRunnerName = outRunnerEntry.key
                        baseRunners.remove(outRunnerName)

                        val runnerEv = innEvents.takeWhile { it != ev }.findLast { it.batterName == outRunnerName }
                        if (runnerEv != null) {
                            currentOuts++
                            playOutNumbers[runnerEv] = currentOuts
                        } else {
                            currentOuts++
                        }
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

                if (ev.runsScoredOnPlay > 0) {
                    var runsToScore = ev.runsScoredOnPlay
                    if (ev.eventType == ScoringEventType.HOME_RUN) {
                        finalBase = 4
                        runsToScore--
                    }
                    val activeRunners = baseRunners.entries.filter { it.key != ev.batterName && it.value < 4 }.sortedByDescending { it.value }
                    for (r in activeRunners) {
                        if (runsToScore > 0) {
                            baseRunners[r.key] = 4
                            runsToScore--
                        }
                    }
                    if (runsToScore > 0 && finalBase < 4) {
                        finalBase = 4
                    }
                }

                playAdvancements[ev] = baseRunners[ev.batterName] ?: finalBase
            }

            innEvents.forEachIndexed { evIdx, ev ->
                val isResolving = ev.eventType in listOf(
                    ScoringEventType.SINGLE, ScoringEventType.DOUBLE, ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN,
                    ScoringEventType.WALK, ScoringEventType.HIT_BY_PITCH, ScoringEventType.STRIKEOUT,
                    ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT,
                    ScoringEventType.ERROR, ScoringEventType.FIELDER_CHOICE, ScoringEventType.SACRIFICE_FLY
                )
                if (isResolving) {
                    var maxB = playAdvancements[ev] ?: 0
                    var outB: Int? = null
                    var outDet: String? = null

                    val isOut = ev.eventType in listOf(
                        ScoringEventType.STRIKEOUT, ScoringEventType.GROUNDOUT,
                        ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT,
                        ScoringEventType.POP_OUT, ScoringEventType.SACRIFICE_FLY
                    )
                    if (isOut) {
                        outB = 1
                        outDet = getScorebookNotation(ev)
                    } else if (maxB > 0) {
                        val rName = ev.batterName
                        val pId = (localAwayRoster + localHomeRoster).find { it.name == rName }?.id
                        if (pId != null) {
                            var currentB = maxB
                            for (i in (evIdx + 1) until innEvents.size) {
                                val subEv = innEvents[i]
                                val subAdvances = parseRunnerAdvances(subEv.description)
                                val targetBase = subAdvances[pId.toString()]
                                if (targetBase != null) {
                                    if (targetBase > 0) {
                                        currentB = targetBase
                                        maxB = maxOf(maxB, targetBase)
                                    } else if (targetBase == 0) {
                                        outB = currentB + 1
                                        outDet = getOutDetail(subEv)
                                        break
                                    }
                                } else {
                                    if (subEv.runsScoredOnPlay > 0 && subAdvances.isEmpty()) {
                                        if (subEv.eventType == ScoringEventType.HOME_RUN) {
                                            maxB = 4
                                            currentB = 4
                                        }
                                    }
                                }
                            }
                        }
                    }
                    playProgressions[ev] = RunnerProgression(maxB, outB, outDet)
                }
            }
        }
    }

    private fun parseRunnerAdvances(description: String): Map<String, Int> {
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

    private fun getOutDetail(subEv: PlayEvent): String {
        return when (subEv.eventType) {
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
    }
}


internal fun getScorebookNotation(ev: PlayEvent): String {
    val suffix = if (ev.description.contains("(Double Play)") || ev.description.contains("(DP)")) " DP" else ""
    return when (ev.eventType) {
        ScoringEventType.SINGLE -> {
            val locNum = getHitLocationNumber(ev.description)
            if (locNum != null) "1B$locNum" else "1B"
        }
        ScoringEventType.DOUBLE -> {
            val locNum = getHitLocationNumber(ev.description)
            if (locNum != null) "2B$locNum" else "2B"
        }
        ScoringEventType.TRIPLE -> {
            val locNum = getHitLocationNumber(ev.description)
            if (locNum != null) "3B$locNum" else "3B"
        }
        ScoringEventType.HOME_RUN -> {
            val locNum = getHitLocationNumber(ev.description)
            if (locNum != null) "HR$locNum" else "HR"
        }
        ScoringEventType.WALK -> "BB"
        ScoringEventType.HIT_BY_PITCH -> "HBP"
        ScoringEventType.STRIKEOUT -> "K$suffix"
        ScoringEventType.GROUNDOUT -> {
            val runnerOutMatch = Regex("Runner Out: (\\d+(?:-\\d+)*U?)").find(ev.description)
            val seqMatch = Regex("Groundout: (\\d+(?:-\\d+)*U?)").find(ev.description)
            val baseNotation = when {
                runnerOutMatch != null -> runnerOutMatch.groupValues[1]
                seqMatch != null -> seqMatch.groupValues[1]
                else -> {
                    val matchNum = Regex("to .* \\((\\d)\\)").find(ev.description)
                    val posNum = matchNum?.groupValues?.get(1) ?: "3"
                    "$posNum-3"
                }
            }
            "$baseNotation$suffix"
        }
        ScoringEventType.FLYOUT -> {
            val matchNum = Regex("to .* \\((\\d)\\)").find(ev.description)
            val posNum = matchNum?.groupValues?.get(1) ?: "8"
            "F$posNum$suffix"
        }
        ScoringEventType.LINE_OUT -> {
            val matchNum = Regex("to .* \\((\\d)\\)").find(ev.description)
            val posNum = matchNum?.groupValues?.get(1) ?: "6"
            "L$posNum$suffix"
        }
        ScoringEventType.POP_OUT -> {
            val matchNum = Regex("to .* \\((\\d)\\)").find(ev.description)
            val posNum = matchNum?.groupValues?.get(1) ?: "4"
            "P$posNum$suffix"
        }
        ScoringEventType.SACRIFICE_FLY -> "SF"
        ScoringEventType.ERROR -> "E"
        ScoringEventType.FIELDER_CHOICE -> {
            val runnerOutMatch = Regex("Runner Out: (\\d+(?:-\\d+)*U?)").find(ev.description)
            val seqMatch = Regex("Fielder's Choice: (\\d+(?:-\\d+)*U?)").find(ev.description)
            val baseNotation = when {
                runnerOutMatch != null -> runnerOutMatch.groupValues[1]
                seqMatch != null -> seqMatch.groupValues[1]
                else -> "FC"
            }
            "$baseNotation$suffix"
        }
        ScoringEventType.STOLEN_BASE -> {
            if (ev.description.contains("to 3B")) "SB3"
            else if (ev.description.contains("to Home")) "SBH"
            else "SB"
        }
        ScoringEventType.CAUGHT_STEALING -> {
            val seqMatch = Regex("Caught Stealing: .* (\\d+(?:-\\d+)*U?)\\)").find(ev.description)
            if (seqMatch != null) "CS ${seqMatch.groupValues[1]}" else "CS"
        }
        ScoringEventType.PICKED_OFF -> {
            val seqMatch = Regex("Picked Off: .* (\\d+(?:-\\d+)*U?)\\)").find(ev.description)
            if (seqMatch != null) "PO ${seqMatch.groupValues[1]}" else "PO"
        }
        ScoringEventType.WILD_PITCH -> "WP"
        ScoringEventType.PASSED_BALL -> "PB"
        ScoringEventType.BALK -> "BK"
        else -> ""
    }
}

fun getHitLocationNumber(desc: String): String? {
    return when {
        desc.contains("Left Field") -> "7"
        desc.contains("Center Field") -> "8"
        desc.contains("Right Field") -> "9"
        desc.contains("Shortstop") -> "6"
        desc.contains("2nd Base") || desc.contains("Second Base") -> "4"
        desc.contains("3rd Base") || desc.contains("Third Base") -> "5"
        desc.contains("1st Base") || desc.contains("First Base") -> "3"
        desc.contains("Pitcher") -> "1"
        desc.contains("Catcher") -> "2"
        desc.contains("Infield") -> "IF"
        else -> null
    }
}
